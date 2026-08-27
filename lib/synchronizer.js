import { listApiKeyProviders } from './inventory.js'
import { createProviderAdapterRegistry } from './adapter-registry.js'
import { createCredentialResolver } from './credentials.js'
import { reconcileModels, catalogPatch } from './reconcile.js'
import { normalizeModels } from './models.js'
import { filterModels, normalizePolicy, validatePolicy } from './policy.js'
import { createTimeoutSignal, isRetryableError, mapWithConcurrency, retryWithBackoff, statusOfError } from './reliability.js'
import { appendHistory, createHistoryEntry, historyEntry, listHistory } from './history.js'
import { lifecycleOptions, lifecycleStatus, selectableModels, updateLifecycle } from './lifecycle.js'
import { appendNotification, listNotifications, createSyncReport, updateNotification } from './reporting.js'

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

function diagnosticMessage(error) {
  return errorMessage(error).replace(/(api[_-]?key|token|secret|authorization|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 160)
}

function adapterErrorType(error) {
  if (error?.adapterCode === 'auth') return 'auth'
  if (error?.adapterCode === 'schema') return 'schema'
  if (error?.adapterCode === 'endpoint') return 'endpoint'
  if (error?.code === 'CREDENTIALS_UNAVAILABLE' || error?.code === 'AUTH') return 'credential'
  const status = statusOfError(error)
  if (status === 401 || status === 403) return 'auth'
  if (status) return 'http'
  return 'endpoint'
}

function rotationRefs(settings, provider) {
  try {
    const rows = settings?.get?.('dsh-key-rotation')?.providers
    if (!Array.isArray(rows)) return []
    return rows.filter((row) => row?.provider === provider).flatMap((row) => Array.isArray(row.keys) ? row.keys : [])
  } catch {
    return []
  }
}

export function createModelSynchronizer(ctx, { getConfig = () => ({}), saveConfig = async () => {}, fetchImpl = fetch, adapterImplementations = {} } = {}) {
  const resolveCredential = createCredentialResolver(ctx)
  const registry = createProviderAdapterRegistry({ resolveCredential, fetchImpl, adapters: adapterImplementations })
  let running = null
  let lastRun = null
  let lastHealth = null
  let healthRunning = null
  const circuits = new Map()
  const credentialOutcomes = new Map()
  let lastReport = null
  let transientNotifications = []

  function recordCredentialOutcome(provider, outcome) {
    credentialOutcomes.set(provider, { ...outcome, at: Date.now() })
  }

  function selectAdapter(profile) {
    const config = getConfig() ?? {}
    return registry.select(profile, config.adapterRegistry?.[profile.provider])
  }

  function refsFor(row, settings) {
    const profile = profileOf(settings, row.provider)
    const refs = [
      row.apiKeyEnv,
      profile.credentialRef,
      ...(Array.isArray(profile.credentialRefs) ? profile.credentialRefs : []),
      ...(Array.isArray(profile.apiKeyRefs) ? profile.apiKeyRefs : []),
      ...rotationRefs(settings, row.provider),
    ]
    return [...new Set(refs.filter((ref) => typeof ref === 'string' && ref.trim()).map((ref) => ref.trim()))].slice(0, 32)
  }

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
      const availableModels = filterModels(available, policy)
      const lifecycleModels = lifecycleStatus(config.modelLifecycle, row.provider, availableModels)
      return {
        ...row,
        selectedModels: selection,
        policy,
        availableModels,
        lifecycleModels,
        selectableModels: lifecycleModels.filter((model) => model.lifecycleStatus === 'active'),
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
    let adapter
    try { adapter = selectAdapter(profile) } catch (error) {
      return { provider: row.provider, status: 'invalid-config', models: [], message: diagnosticMessage(error), code: error?.code ?? 'ADAPTER_CONFIG_INVALID' }
    }
    if (!adapter) return { provider: row.provider, status: 'unsupported', models: [], message: 'no supported API-key model adapter' }
    const adapterConfig = getConfig()?.adapterRegistry?.[row.provider]
    if (!profile.apiKeyEnv && !profile.baseURL && !adapterConfig?.endpoint && !profile.adapterId) {
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
      recordCredentialOutcome(row.provider, { status: 'ok', retries })
      return { provider: row.provider, status: 'ok', models, retries }
    } catch (error) {
      if (!signal?.aborted) recordFailure(row.provider, reliability, error)
      const state = circuits.get(row.provider)
      recordCredentialOutcome(row.provider, { status: 'error', code: statusOfError(error), errorType: adapterErrorType(error), retryable: isRetryableError(error), message: diagnosticMessage(error), retries })
      return {
        provider: row.provider,
        status: 'error',
        models: [],
        message: diagnosticMessage(error),
        errorType: adapterErrorType(error),
        retries,
        retryable: isRetryableError(error),
        circuitOpen: Boolean(state?.blockedUntil > Date.now()),
      }
    }
  }

  async function probe(row, { signal, reliability = DEFAULT_RELIABILITY } = {}) {
    const settings = settingsOf(ctx)
    const profile = { ...profileOf(settings, row.provider), provider: row.provider }
    let adapter
    try { adapter = selectAdapter(profile) } catch (error) {
      return { provider: row.provider, status: 'invalid-config', message: diagnosticMessage(error), code: error?.code ?? 'ADAPTER_CONFIG_INVALID' }
    }
    if (!adapter?.health) return { provider: row.provider, status: 'unsupported', message: 'provider has no health probe' }
    const adapterConfig = getConfig()?.adapterRegistry?.[row.provider]
    if (!profile.apiKeyEnv && !profile.baseURL && !adapterConfig?.endpoint && !profile.adapterId) {
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
      recordCredentialOutcome(row.provider, { status: 'ok', code: result?.statusCode ?? 200, retries })
      return {
        provider: row.provider,
        status: 'ok',
        statusCode: result?.statusCode ?? 200,
        latencyMs: result?.latencyMs ?? Date.now() - startedAt,
        retries,
      }
    } catch (error) {
      recordCredentialOutcome(row.provider, { status: 'error', code: statusOfError(error), errorType: adapterErrorType(error), retryable: isRetryableError(error), message: diagnosticMessage(error), retries })
      return {
        provider: row.provider,
        status: 'error',
        statusCode: statusOfError(error),
        latencyMs: Date.now() - startedAt,
        message: diagnosticMessage(error),
        errorType: adapterErrorType(error),
        retries,
        retryable: isRetryableError(error),
      }
    }
  }

  async function credentialDiagnostics(options = {}) {
    const settings = settingsOf(ctx)
    const selected = typeof options.provider === 'string' && options.provider
      ? providers().filter((row) => row.provider === options.provider && row.configured)
      : providers().filter((row) => row.configured)
    const results = await Promise.all(selected.map(async (row) => {
      const refs = refsFor(row, settings)
      const rotation = rotationRefs(settings, row.provider)
      const diagnostics = typeof resolveCredential.diagnostics === 'function'
        ? await resolveCredential.diagnostics(refs)
        : []
      return {
        provider: row.provider,
        displayName: row.displayName,
        refs: diagnostics,
        rotation: {
          configured: rotation.length > 0,
          keyCount: rotation.length,
          fallbackOrder: diagnostics.filter((item) => rotation.includes(item.ref)).map((item) => item.label),
        },
        ...(credentialOutcomes.has(row.provider) ? { lastRequest: structuredClone(credentialOutcomes.get(row.provider)) } : {}),
      }
    }))
    return { checkedAt: Date.now(), results }
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
    const nextLifecycle = structuredClone(config.modelLifecycle ?? {})
    const lifecycleRun = (Number(config.lifecycleRevision) || 0) + 1
    const lifecycleConfig = lifecycleOptions(config)
    const dryRun = options.dryRun !== false
    const removeMissing = options.removeMissing === true
    const providerConfig = Array.isArray(config.providers) ? config.providers : []
    const globalAutoApply = config.autoApply === true
    const providerAutoApply = (provider) => { const entry = providerConfig.find((item) => item.provider === provider); return entry && typeof entry.autoApply === 'boolean' ? entry.autoApply : globalAutoApply }
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
        const lifecycleBefore = normalizeModels(row.provider, config.modelCatalogs?.[row.provider] ?? current)
        const lifecycle = updateLifecycle(config.modelLifecycle?.[row.provider], lifecycleBefore, fullModels, {
          runNumber: lifecycleRun,
          ...lifecycleConfig,
          removeMissing,
        })
        nextLifecycle[row.provider] = lifecycle.records
        const policy = policyFor(config, row.provider)
        const policyModels = filterModels(fullModels, policy)
        const selectedModels = selectionFor(config, row.provider)
        const advertised = selectedModels.length
          ? policyModels.filter((model) => selectedModels.includes(model.id))
          : policyModels
        const explicitRemoveIds = new Set(lifecycle.removedIds)
        const reconciliation = reconcileModels(row.provider, current, advertised, { removeMissing: false, removeIds: explicitRemoveIds })
        results.push({
          ...discovered,
          discoveredModels: fullModels,
          availableModels: policyModels,
          policy,
          selectedModels,
          advertised,
          lifecycle: lifecycle.statuses,
          lifecycleChanges: lifecycle.changes,
          ...reconciliation,
          removeMissing: lifecycle.removedIds.length > 0,
          changed: reconciliation.changed,
        })
        const freshIds = new Set(fullModels.map((model) => model.id))
        const removedIds = new Set(lifecycle.removedIds)
        const retainedCatalog = lifecycleBefore.filter((model) => !freshIds.has(model.id) && !removedIds.has(model.id))
        cachedCatalogs[row.provider] = normalizeModels(row.provider, [...retainedCatalog, ...fullModels])
      }
      const result = { startedAt, finishedAt: Date.now(), dryRun, removeMissing, reliability, lifecycleRevision: lifecycleRun, results, applied: false }
      const report = createSyncReport(result, { source: options.reportSource === 'schedule' ? 'schedule' : 'manual' })
      lastReport = report
      const notificationLimit = config.notificationLimit
      transientNotifications = appendNotification(transientNotifications, report, { limit: notificationLimit })
      result.report = report
      const resultsToApply = results.filter((row) => row.status === 'ok' && row.changed && (!dryRun || providerAutoApply(row.provider)))
      if (resultsToApply.length > 0) {
        const settings = settingsOf(ctx)
        const section = settings?.get?.(PIAI_NS)
        const descriptor = descriptorOf(settings, PIAI_NS)
        if (!section || !descriptor || typeof settings.replace !== 'function') {
          throw Object.assign(new Error('llm-pi-ai settings are not writable'), { code: 'SETTINGS_UNAVAILABLE' })
        }
        const next = structuredClone(section)
        for (const row of resultsToApply) {
          next.providers = catalogPatch(next, row.provider, row.next).providers
        }
        await settings.replace(PIAI_NS, next, descriptor.revision)
        result.applied = true
      }
      if (!dryRun || resultsToApply.length > 0) {
        const previousCatalogs = config.modelCatalogs ?? {}
        const patch = { modelLifecycle: nextLifecycle, lifecycleRevision: lifecycleRun }
        if (JSON.stringify(previousCatalogs) !== JSON.stringify(cachedCatalogs)) patch.modelCatalogs = cachedCatalogs
        const previousHistory = Array.isArray(config.history) ? config.history : []
        const nextVersion = previousHistory.reduce((max, entry) => Math.max(max, Number(entry?.version) || 0), 0) + 1
        const entry = createHistoryEntry(result, { version: nextVersion })
        patch.history = appendHistory(previousHistory, entry, config.historyLimit)
        const previousNotifications = Array.isArray(config.notifications) ? config.notifications : []
        const nextNotifications = appendNotification(previousNotifications, report, { limit: config.notificationLimit })
        if (JSON.stringify(previousNotifications) !== JSON.stringify(nextNotifications)) patch.notifications = nextNotifications
        result.historyId = entry.id
        try {
          await saveConfig(patch)
          if (patch.modelCatalogs) result.catalogCachePersisted = true
          result.historyPersisted = true
        } catch (error) {
          // The active DSH catalog has already been revision-checked. A cache
          // or history failure is visible but must not undo that successful
          // provider update.
          if (patch.modelCatalogs) result.catalogCacheError = errorMessage(error)
          result.historyError = errorMessage(error)
        }
      }
      result.notifications = notificationLedger()
      lastRun = result
      return result
    })()
    running = task.finally(() => { running = null })
    return running
  }

  function history(options = {}) {
    const config = getConfig() ?? {}
    return listHistory(config.history, options)
  }

  function notificationLedger(options = {}) {
    const config = getConfig() ?? {}
    const byId = new Map()
    for (const row of [...(Array.isArray(config.notifications) ? config.notifications : []), ...transientNotifications]) {
      if (row?.id) byId.set(row.id, row)
    }
    return listNotifications([...byId.values()], options)
  }

  async function updateNotificationState(id, field) {
    const config = getConfig() ?? {}
    const persisted = Array.isArray(config.notifications) ? config.notifications : []
    if (persisted.some((row) => row?.id === id)) {
      const next = updateNotification(persisted, id, field)
      await saveConfig({ notifications: next })
      transientNotifications = transientNotifications.filter((row) => row?.id !== id)
      return next.find((row) => row.id === id)
    }
    transientNotifications = updateNotification(transientNotifications, id, field)
    return transientNotifications.find((row) => row.id === id)
  }

  async function tryModel({ provider, model } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (typeof model !== 'string' || !model) throw new Error('model is required')
    const start = Date.now()
    // Use health as lightweight probe; latency is the signal
    const result = await health({ provider })
    const entry = result?.results?.find((r) => r.provider === provider)
    return { provider, model, ok: entry?.status === 'ok', latencyMs: Date.now() - start, status: entry?.status ?? 'unknown' }
  }

  async function rollbackHistory({ historyId, provider } = {}) {
    if (typeof historyId !== 'string' || !historyId) throw Object.assign(new Error('historyId is required'), { code: 'INVALID_HISTORY' })
    if (typeof provider !== 'string' || !provider) throw Object.assign(new Error('provider is required'), { code: 'INVALID_HISTORY' })
    const config = getConfig() ?? {}
    const entry = historyEntry(config.history, historyId)
    if (!entry) throw Object.assign(new Error(`history entry not found: ${historyId}`), { code: 'HISTORY_NOT_FOUND' })
    const snapshot = (entry.providers ?? []).find((row) => row.provider === provider)
    if (!snapshot || !Array.isArray(snapshot.before)) throw Object.assign(new Error(`history snapshot not found: ${provider}`), { code: 'HISTORY_NOT_FOUND' })
    if (!providers().some((row) => row.provider === provider && row.configured)) throw Object.assign(new Error(`provider is not configured: ${provider}`), { code: 'PROVIDER_NOT_CONFIGURED' })
    const settings = settingsOf(ctx)
    const section = settings?.get?.(PIAI_NS)
    const descriptor = descriptorOf(settings, PIAI_NS)
    if (!section || !descriptor || typeof settings.replace !== 'function') {
      throw Object.assign(new Error('llm-pi-ai settings are not writable'), { code: 'SETTINGS_UNAVAILABLE' })
    }
    const current = normalizeModels(provider, profileOf(settings, provider).models ?? [])
    const target = normalizeModels(provider, snapshot.before)
    if (JSON.stringify(current) === JSON.stringify(target)) {
      return { historyId, provider, models: target, applied: false, allowlistUntouched: true }
    }
    const next = catalogPatch(section, provider, target)
    await settings.replace(PIAI_NS, next, descriptor.revision)
    return { historyId, provider, models: target, applied: true, allowlistUntouched: true }
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
    const safeAvailable = selectableModels(config.modelLifecycle, provider, available)
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
      : (safeAvailable.length > 0 ? safeAvailable : current)
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
    return { provider, selectedModels, models: nextModels, availableModels: available, selectableModels: safeAvailable, applied: true }
  }

  return Object.freeze({
    listProviders: providers,
    getProvider: (provider) => providers().find((row) => row.provider === provider) ?? null,
    adapterRegistry: registry,
    registerAdapter: registry.register,
    discover,
    run,
    setModelSelection,
    setModelPolicy,
    listPolicies,
    health,
    tryModel,
    credentialDiagnostics,
    history,
    report: () => structuredClone(lastReport),
    notifications: notificationLedger,
    updateNotification: updateNotificationState,
    rollbackHistory,
    status: () => ({ running: Boolean(running), lastRun, lastHealth, lastReport: structuredClone(lastReport), notifications: notificationLedger(), history: history(), policies: listPolicies(), lifecycle: structuredClone(getConfig()?.modelLifecycle ?? {}) }),
  })
}
