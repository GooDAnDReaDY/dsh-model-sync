import { listApiKeyProviders } from './inventory.js'
import { createProviderAdapterRegistry } from './adapter-registry.js'
import { createCredentialResolver } from './credentials.js'
import { reconcileModels, catalogPatch } from './reconcile.js'
import { normalizeModels } from './models.js'
import { filterModels, hasPolicy, normalizePolicy, validatePolicy } from './policy.js'
import { createTimeoutSignal, isRetryableError, mapWithConcurrency, retryWithBackoff, statusOfError } from './reliability.js'

const PIAI_NS = 'llm-pi-ai'
const DEFAULT_RELIABILITY = Object.freeze({
  timeoutMs: 15000,
  retryAttempts: 3,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 4000,
  concurrency: 4,
  circuitBreakerFailures: 3,
  circuitBreakerCooldownMs: 300000,
})

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.floor(number)))
}

function reliabilityOptions(config, options) {
  const source = { ...config, ...options }
  const baseDelay = boundedInteger(source.retryBaseDelayMs, DEFAULT_RELIABILITY.retryBaseDelayMs, 0, 60000)
  const cooldownMs = source.circuitBreakerCooldownMs !== undefined
    ? boundedInteger(source.circuitBreakerCooldownMs, DEFAULT_RELIABILITY.circuitBreakerCooldownMs, 0, 3600000)
    : boundedInteger(Number(source.circuitBreakerCooldownMinutes) * 60000, DEFAULT_RELIABILITY.circuitBreakerCooldownMs, 0, 3600000)
  return {
    timeoutMs: boundedInteger(source.requestTimeoutMs, DEFAULT_RELIABILITY.timeoutMs, 100, 120000),
    retryAttempts: boundedInteger(source.retryAttempts, DEFAULT_RELIABILITY.retryAttempts, 1, 6),
    retryBaseDelayMs: baseDelay,
    retryMaxDelayMs: Math.max(baseDelay, boundedInteger(source.retryMaxDelayMs, DEFAULT_RELIABILITY.retryMaxDelayMs, 0, 120000)),
    concurrency: boundedInteger(source.concurrency, DEFAULT_RELIABILITY.concurrency, 1, 32),
    circuitBreakerFailures: boundedInteger(source.circuitBreakerFailures, DEFAULT_RELIABILITY.circuitBreakerFailures, 0, 20),
    circuitBreakerCooldownMs: cooldownMs,
  }
}

function settingsOf(ctx) {
  try { return ctx.get('settings') } catch { return undefined }
}

function descriptorOf(settings, ns) {
  try { return settings?.describe?.({ redactSecrets: true })?.find((row) => row.ns === ns) }
  catch { return undefined }
}

function profileOf(settings, provider) {
  try { return settings?.get(PIAI_NS)?.providers?.[provider] ?? {} }
  catch { return {} }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function createModelSynchronizer(ctx, { getConfig = () => ({}), saveConfig = async () => {}, fetchImpl = fetch } = {}) {
  const resolveCredential = createCredentialResolver(ctx)
  const registry = createProviderAdapterRegistry({ resolveCredential, fetchImpl })
  let running = null
  let lastRun = null
  let lastHealth = null
  let healthRunning = null
  const circuits = new Map()

  function circuitOpen(provider, reliability) {
    if (reliability.circuitBreakerFailures <= 0) return null
    const state = circuits.get(provider)
    if (!state) return null
    if (state.blockedUntil > Date.now()) {
      return { retryAfterMs: state.blockedUntil - Date.now() }
    }
    if (state.blockedUntil) circuits.delete(provider)
    return null
  }

  function recordFailure(provider, reliability, error) {
    if (reliability.circuitBreakerFailures <= 0 || !isRetryableError(error)) return
    const state = circuits.get(provider) ?? { failures: 0, blockedUntil: 0 }
    state.failures += 1
    if (state.failures >= reliability.circuitBreakerFailures) {
      state.blockedUntil = Date.now() + reliability.circuitBreakerCooldownMs
    }
    circuits.set(provider, state)
  }

  function policyFor(config, provider) {
    return normalizePolicy(config?.modelPolicies?.[provider])
  }

  function providers() {
    const config = getConfig() ?? {}
    const lastResults = new Map((lastRun?.results ?? []).map((row) => [row.provider, row]))
    return listApiKeyProviders(ctx.llm, settingsOf(ctx)).map((row) => {
      const selection = Array.isArray(config.modelSelections?.[row.provider])
        ? [...new Set(config.modelSelections[row.provider].filter((id) => typeof id === 'string' && id))]
        : []
      const latest = lastResults.get(row.provider)
      const policy = policyFor(config, row.provider)
      const cached = normalizeModels(row.provider, config.modelCatalogs?.[row.provider])
      const available = latest?.status === 'ok'
        ? latest.availableModels ?? latest.models ?? row.models
        : cached.length > 0 ? cached : row.models
      return {
        ...row,
        selectedModels: selection,
        policy,
        availableModels: filterModels(available, policy),
      }
    })
  }

  function listPolicies() {
    const config = getConfig() ?? {}
    return Object.fromEntries(providers()
      .filter((row) => row.configured)
      .map((row) => [row.provider, policyFor(config, row.provider)]))
  }

  function selectionFor(config, provider) {
    const selection = config?.modelSelections?.[provider]
    return Array.isArray(selection) ? [...new Set(selection.filter((id) => typeof id === 'string' && id))] : []
  }

  async function discover(row, { signal, reliability = DEFAULT_RELIABILITY } = {}) {
    const settings = settingsOf(ctx)
    const profile = { ...profileOf(settings, row.provider), provider: row.provider }
    const adapter = registry.select(profile)
    if (!adapter) return { provider: row.provider, status: 'unsupported', models: [], message: 'no supported API-key model adapter' }
    if (!profile.apiKeyEnv && !profile.baseURL) {
      return { provider: row.provider, status: 'dormant', models: [], message: 'provider has no API key route configured' }
    }
    const open = circuitOpen(row.provider, reliability)
    if (open) {
      return {
        provider: row.provider,
        status: 'circuit-open',
        models: [],
        message: 'provider circuit is open after repeated transient failures',
        retryAfterMs: open.retryAfterMs,
      }
    }
    let retries = 0
    try {
      const models = await retryWithBackoff(async () => {
        const timed = createTimeoutSignal(signal, reliability.timeoutMs)
        try {
          return await adapter.discover(profile, { signal: timed.signal })
        } finally {
          timed.cleanup()
        }
      }, {
        attempts: reliability.retryAttempts,
        baseDelayMs: reliability.retryBaseDelayMs,
        maxDelayMs: reliability.retryMaxDelayMs,
        signal,
        onRetry: () => { retries += 1 },
      })
      circuits.delete(row.provider)
      return { provider: row.provider, status: 'ok', models, retries }
    } catch (error) {
      if (!signal?.aborted) recordFailure(row.provider, reliability, error)
      const state = circuits.get(row.provider)
      return {
        provider: row.provider,
        status: 'error',
        models: [],
        message: errorMessage(error),
        retries,
        retryable: isRetryableError(error),
        circuitOpen: Boolean(state?.blockedUntil > Date.now()),
      }
    }
  }

  async function probe(row, { signal, reliability = DEFAULT_RELIABILITY } = {}) {
    const settings = settingsOf(ctx)
    const profile = { ...profileOf(settings, row.provider), provider: row.provider }
    const adapter = registry.select(profile)
    if (!adapter?.health) return { provider: row.provider, status: 'unsupported', message: 'provider has no health probe' }
    if (!profile.apiKeyEnv && !profile.baseURL) {
      return { provider: row.provider, status: 'dormant', message: 'provider has no API key route configured' }
    }
    const startedAt = Date.now()
    let retries = 0
    try {
      const result = await retryWithBackoff(async () => {
        const timed = createTimeoutSignal(signal, reliability.timeoutMs)
        try {
          return await adapter.health(profile, { signal: timed.signal })
        } finally {
          timed.cleanup()
        }
      }, {
        attempts: reliability.retryAttempts,
        baseDelayMs: reliability.retryBaseDelayMs,
        maxDelayMs: reliability.retryMaxDelayMs,
        signal,
        onRetry: () => { retries += 1 },
      })
      return {
        provider: row.provider,
        status: 'ok',
        statusCode: result?.statusCode ?? 200,
        latencyMs: result?.latencyMs ?? Date.now() - startedAt,
        retries,
      }
    } catch (error) {
      return {
        provider: row.provider,
        status: 'error',
        statusCode: statusOfError(error),
        latencyMs: Date.now() - startedAt,
        message: errorMessage(error),
        retries,
        retryable: isRetryableError(error),
      }
    }
  }

  async function health(options = {}) {
    if (healthRunning) return healthRunning
    const config = getConfig() ?? {}
    const reliability = reliabilityOptions(config, options)
    const providerConfig = Array.isArray(config.providers) ? config.providers : []
    const selected = typeof options.provider === 'string' && options.provider
      ? providers().filter((row) => row.provider === options.provider)
      : providers().filter((row) => providerConfig.length === 0 || providerConfig.some((item) => item.provider === row.provider && item.enabled !== false))
    const startedAt = Date.now()
    const task = (async () => {
      const results = await mapWithConcurrency(
        selected,
        (row) => probe(row, { signal: options.signal, reliability }),
        reliability.concurrency,
      )
      const snapshot = { startedAt, finishedAt: Date.now(), reliability, results }
      lastHealth = snapshot
      return snapshot
    })()
    healthRunning = task.finally(() => { healthRunning = null })
    return healthRunning
  }

  async function run(options = {}) {
    if (running) return running
    const config = getConfig() ?? {}
    const reliability = reliabilityOptions(config, options)
    const cachedCatalogs = structuredClone(config.modelCatalogs ?? {})
    const dryRun = options.dryRun !== false
    const removeMissing = options.removeMissing === true
    const providerConfig = Array.isArray(config.providers) ? config.providers : []
    const selected = typeof options.provider === 'string' && options.provider
      ? providers().filter((row) => row.provider === options.provider)
      : providers().filter((row) => providerConfig.length === 0 || providerConfig.some((item) => item.provider === row.provider && item.enabled !== false))
    const startedAt = Date.now()
    const task = (async () => {
      const discoveredRows = await mapWithConcurrency(
        selected,
        (row) => discover(row, { signal: options.signal, reliability }),
        reliability.concurrency,
      )
      const results = []
      for (let index = 0; index < selected.length; index += 1) {
        const row = selected[index]
        const discovered = discoveredRows[index]
        if (discovered.status !== 'ok') {
          results.push({ ...discovered, changed: false })
          continue
        }
        const settings = settingsOf(ctx)
        const current = profileOf(settings, row.provider).models ?? row.models
        const fullModels = normalizeModels(row.provider, discovered.models)
        const policy = policyFor(config, row.provider)
        const policyModels = filterModels(fullModels, policy)
        const selectedModels = selectionFor(config, row.provider)
        const advertised = selectedModels.length
          ? policyModels.filter((model) => selectedModels.includes(model.id))
          : policyModels
        const effectiveRemoveMissing = removeMissing || selectedModels.length > 0 || hasPolicy(policy)
        const reconciliation = reconcileModels(row.provider, current, advertised, { removeMissing: effectiveRemoveMissing })
        results.push({
          ...discovered,
          discoveredModels: fullModels,
          availableModels: policyModels,
          policy,
          selectedModels,
          advertised,
          ...reconciliation,
          removeMissing: effectiveRemoveMissing,
          changed: reconciliation.changed,
        })
        cachedCatalogs[row.provider] = fullModels
      }
      const result = { startedAt, finishedAt: Date.now(), dryRun, removeMissing, reliability, results, applied: false }
      if (!dryRun && results.some((row) => row.status === 'ok' && row.changed)) {
        const settings = settingsOf(ctx)
        const section = settings?.get?.(PIAI_NS)
        const descriptor = descriptorOf(settings, PIAI_NS)
        if (!section || !descriptor || typeof settings.replace !== 'function') {
          throw Object.assign(new Error('llm-pi-ai settings are not writable'), { code: 'SETTINGS_UNAVAILABLE' })
        }
        const next = structuredClone(section)
        for (const row of results) {
          if (row.status === 'ok' && row.changed) next.providers = catalogPatch(next, row.provider, row.next).providers
        }
        await settings.replace(PIAI_NS, next, descriptor.revision)
        result.applied = true
      }
      if (!dryRun) {
        const previousCatalogs = config.modelCatalogs ?? {}
        if (JSON.stringify(previousCatalogs) !== JSON.stringify(cachedCatalogs)) {
          try {
            await saveConfig({ modelCatalogs: cachedCatalogs })
            result.catalogCachePersisted = true
          } catch (error) {
            // The active DSH catalog has already been revision-checked. A
            // cache failure must be visible but must not undo that successful
            // provider update.
            result.catalogCacheError = errorMessage(error)
          }
        }
      }
      lastRun = result
      return result
    })()
    running = task.finally(() => { running = null })
    return running
  }

  async function setModelPolicy(provider, policy) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    const row = providers().find((item) => item.provider === provider && item.configured)
    if (!row) throw Object.assign(new Error(`provider is not configured: ${provider}`), { code: 'PROVIDER_NOT_CONFIGURED' })
    const normalized = validatePolicy(policy)
    const config = getConfig() ?? {}
    const previous = structuredClone(config.modelPolicies ?? {})
    const modelPolicies = { ...previous, [provider]: normalized }
    await saveConfig({ modelPolicies })
    return { provider, policy: normalized, applied: false }
  }

  async function setModelSelection(provider, models) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (!Array.isArray(models)) throw new Error('models must be an array')
    const selectedModels = [...new Set(models.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
    const config = getConfig() ?? {}
    const row = providers().find((item) => item.provider === provider)
    if (!row) throw Object.assign(new Error(`provider is not configured: ${provider}`), { code: 'PROVIDER_NOT_CONFIGURED' })
    const latest = lastRun?.results?.find((item) => item.provider === provider && item.status === 'ok')
    const cached = normalizeModels(provider, config.modelCatalogs?.[provider])
    const latestCatalog = latest?.availableModels ?? latest?.models
    const source = latestCatalog !== undefined
      ? latestCatalog
      : cached.length > 0 ? cached : row.availableModels ?? row.models
    const available = filterModels(normalizeModels(provider, source), policyFor(config, provider))
    const availableById = new Map(available.map((model) => [model.id, model]))
    const unknown = selectedModels.filter((id) => !availableById.has(id))
    if (unknown.length > 0) throw Object.assign(new Error(`unknown models for ${provider}: ${unknown.join(', ')}`), { code: 'UNKNOWN_MODEL' })
    if (typeof saveConfig !== 'function') throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })

    const settings = settingsOf(ctx)
    const section = settings?.get?.(PIAI_NS)
    const descriptor = descriptorOf(settings, PIAI_NS)
    if (!section || !descriptor || typeof settings.replace !== 'function') {
      throw Object.assign(new Error('llm-pi-ai settings are not writable'), { code: 'SETTINGS_UNAVAILABLE' })
    }
    const current = normalizeModels(provider, profileOf(settings, provider).models ?? row.models)
    const nextModels = selectedModels.length
      ? selectedModels.map((id) => availableById.get(id))
      : (available.length > 0 ? available : current)
    const next = catalogPatch(section, provider, nextModels)
    const previousModelSelections = structuredClone(config.modelSelections ?? {})
    const modelSelections = { ...previousModelSelections, [provider]: selectedModels }

    // Persist the allowlist first. If the LLM catalog write fails, roll the
    // allowlist back so the two namespaces cannot be left disagreeing.
    await saveConfig({ modelSelections })
    try {
      await settings.replace(PIAI_NS, next, descriptor.revision)
    } catch (error) {
      try {
        await saveConfig({ modelSelections: previousModelSelections })
      } catch {
        // Preserve the original, more actionable catalog-write error.
      }
      throw error
    }
    return { provider, selectedModels, models: nextModels, availableModels: available, applied: true }
  }

  return Object.freeze({
    listProviders: providers,
    getProvider: (provider) => providers().find((row) => row.provider === provider) ?? null,
    discover,
    run,
    setModelSelection,
    setModelPolicy,
    listPolicies,
    health,
    status: () => ({ running: Boolean(running), lastRun, lastHealth, policies: listPolicies() }),
  })
}
