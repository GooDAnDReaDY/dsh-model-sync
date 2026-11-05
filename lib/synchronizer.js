import { dispatchDiffNotifications } from './diff-notifier.js'
import { createRuntimeStateStore } from './state-store.js'
import { createPricingService } from './services/pricing-service.js'
import { createOllamaService } from './services/ollama-service.js'
import { createProbingService } from './services/probing-service.js'
import { createPolicyService } from './services/policy-service.js'
import { listApiKeyProviders } from './inventory.js'
import { createProviderAdapterRegistry } from './adapter-registry.js'
import { createCredentialResolver } from './credentials.js'
import { reconcileModels, catalogPatch } from './reconcile.js'
import { normalizeModels, isDateSnapshotModel, extractCanonicalBaseId, collapseSnapshotModels, stripDisplayNameBadges, formatDisplayNameWithBadges } from './models.js'
import { filterModels, normalizePolicy, validatePolicy } from './policy.js'
import { createTimeoutSignal, isRetryableError, mapWithConcurrency, retryWithBackoff, statusOfError } from './reliability.js'
import { appendHistory, createHistoryEntry, listHistory } from './history.js'
import { lifecycleOptions, lifecycleStatus, selectableModels, updateLifecycle } from './lifecycle.js'
import { appendNotification, listNotifications, createSyncReport, updateNotification } from './reporting.js'

import {
  PIAI_NS,
  DEFAULT_RELIABILITY,
  boundedInteger,
  reliabilityOptions,
  settingsOf,
  llmOf,
  descriptorOf,
  sectionOf,
  profileOf,
  errorMessage,
  diagnosticMessage,
  adapterErrorType,
  replaceWithRetry,
  rotationRefs,
  refsFor,
  performHistoryRollback,
} from './synchronizer-helpers.js'
import { createConfigTransfer } from './synchronizer-transfer.js'
import { createModelProber } from './synchronizer-prober.js'

export function createModelSynchronizer(ctx, { getConfig = () => ({}), saveConfig = async () => {}, fetchImpl = fetch, adapterImplementations = {}, probeModel, stateStore: providedStateStore = null } = {}) {
  const stateStore = providedStateStore ?? createRuntimeStateStore({
    initialState: getConfig() ?? {},
    persistToDisk: false,
  })
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
  const providerHttpMeta = new Map()

  function recordCredentialOutcome(provider, outcome) {
    credentialOutcomes.set(provider, { ...outcome, at: Date.now() })
  }

  function selectAdapter(profile) {
    const config = getConfig() ?? {}
    return registry.select(profile, config.adapterRegistry?.[profile.provider])
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
    return listApiKeyProviders(llmOf(ctx), settingsOf(ctx)).map((row) => {
      const selection = Array.isArray(config.modelSelections?.[row.provider])
        ? [...new Set(config.modelSelections[row.provider].filter((id) => typeof id === 'string' && id))]
        : []
      const latest = lastResults.get(row.provider)
      const policy = policyFor(config, row.provider)
      const cached = normalizeModels(row.provider, config.modelCatalogs?.[row.provider])
      const available = latest?.status === 'ok'
        ? latest.availableModels ?? latest.models ?? row.models
        : cached.length > 0 ? cached : row.models
      const filterOpts = { excludeUtilityModels: config.excludeUtilityModels !== false }
      const availableModels = filterModels(available, policy, filterOpts)
      const lifecycleModels = lifecycleStatus(config.modelLifecycle, row.provider, availableModels)
      const baseSelectable = lifecycleModels.filter((model) => model.lifecycleStatus === 'active')
      const selectable = config.collapseDateSnapshots !== false
        ? collapseSnapshotModels(baseSelectable)
        : baseSelectable
      return {
        ...row,
        selectedModels: selection,
        policy,
        availableModels,
        lifecycleModels,
        selectableModels: selectable,
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
    const existingMeta = providerHttpMeta.get(row.provider)
    try {
      const result = await retryWithBackoff(async () => {
        const timed = createTimeoutSignal(signal, reliability.timeoutMs)
        try {
          return await adapter.discover(profile, { signal: timed.signal, etag: existingMeta?.etag, lastModified: existingMeta?.lastModified })
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
      if (result && result.notModified) {
        const config = getConfig() ?? {}
        const existing = providerHttpMeta.get(row.provider)
        if (existing && (result.etag || result.lastModified)) {
          if (result.etag) existing.etag = result.etag
          if (result.lastModified) existing.lastModified = result.lastModified
        }
        const memoryModels = existing?.models
        const cached = normalizeModels(row.provider, memoryModels ?? config.modelCatalogs?.[row.provider] ?? row.models ?? [])
        return { provider: row.provider, status: 'ok', models: cached, retries, notModified: true }
      }
      const models = Array.isArray(result) ? result : []
      if (result?.__httpMeta) {
        providerHttpMeta.set(row.provider, { ...result.__httpMeta, models })
      }
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
        const existingMap = new Map(lifecycleBefore.map((m) => [m.id, m]))
        const nowIso = new Date(startedAt).toISOString()
        for (const model of fullModels) {
          const prev = existingMap.get(model.id)
          if (prev?.firstSeenAt) {
            model.firstSeenAt = prev.firstSeenAt
          } else if (!model.firstSeenAt) {
            model.firstSeenAt = nowIso
          }
          if (prev?.createdAt && !model.createdAt) {
            model.createdAt = prev.createdAt
          }
        }
        const lifecycle = updateLifecycle(config.modelLifecycle?.[row.provider], lifecycleBefore, fullModels, {
          runNumber: lifecycleRun,
          ...lifecycleConfig,
          removeMissing,
        })
        nextLifecycle[row.provider] = lifecycle.records
        const policy = policyFor(config, row.provider)
        const filterOpts = { excludeUtilityModels: config.excludeUtilityModels !== false }
        const policyModels = filterModels(fullModels, policy, filterOpts)
        const selectedModels = selectionFor(config, row.provider)

        const activePolicyModels = policyModels.filter((model) => {
          const status = lifecycle.records[model.id]?.status ?? 'active'
          return status === 'active'
        })
        const curatedPolicyModels = config.collapseDateSnapshots !== false
          ? collapseSnapshotModels(activePolicyModels)
          : activePolicyModels

        const badgesConfig = config.displayNameBadges
        const applyBadges = Boolean(badgesConfig?.enabled)
        const formatModelName = (model) => {
          if (!model) return model
          const name = applyBadges
            ? formatDisplayNameWithBadges(model, badgesConfig)
            : stripDisplayNameBadges(model.name || model.id)
          return { ...model, name }
        }

        const rawAdvertised = selectedModels.length
          ? policyModels.filter((model) => selectedModels.includes(model.id))
          : curatedPolicyModels
        const advertised = rawAdvertised.map(formatModelName)

        const staleGraceRuns = lifecycleConfig.staleGraceRuns ?? 2
        const autoHideIds = current
          .filter((model) => {
            const rec = lifecycle.records[model.id]
            if (rec?.status === 'deprecated') return true
            if (rec?.status === 'stale' && rec.consecutiveMissing >= staleGraceRuns) return true
            return false
          })
          .map((m) => m.id)

        const policyExcludedIds = current
          .filter((model) => !filterModels([model], policy, filterOpts).length || (selectedModels.length && !selectedModels.includes(model.id)))
          .map((model) => model.id)

        const snapshotExcludedIds = (config.collapseDateSnapshots !== false && !selectedModels.length)
          ? current.filter((m) => isDateSnapshotModel(m.id) && advertised.some((adv) => adv.id === extractCanonicalBaseId(m.id))).map((m) => m.id)
          : []

        const explicitRemoveIds = new Set([
          ...lifecycle.removedIds,
          ...autoHideIds,
          ...policyExcludedIds,
          ...snapshotExcludedIds,
        ])
        const reconciliation = reconcileModels(row.provider, current, advertised, { removeMissing: false, removeIds: explicitRemoveIds })
        const deprecatedCount = lifecycle.statuses.filter((s) => s.status === 'deprecated').length
        const staleCount = lifecycle.statuses.filter((s) => s.status === 'stale' && s.consecutiveMissing >= staleGraceRuns).length
        results.push({
          ...discovered,
          discoveredModels: fullModels,
          availableModels: policyModels,
          policy,
          selectedModels,
          advertised,
          lifecycle: lifecycle.statuses,
          lifecycleChanges: lifecycle.changes,
          deprecatedCount,
          staleCount,
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
        const piaiRows = resultsToApply.filter((r) => r.provider !== 'commandcode')
        const ccRows = resultsToApply.filter((r) => r.provider === 'commandcode')
        if (piaiRows.length > 0) {
          await replaceWithRetry(settings, PIAI_NS, (section) => {
            let next = section
            for (const row of piaiRows) {
              next = catalogPatch(next, row.provider, row.next)
            }
            return next
          })
        }
        for (const row of ccRows) {
          if (typeof settings?.mutate === 'function') {
            await settings.mutate('llm-commandcode', [
              { op: 'set', path: ['visibleModels'], value: row.selectedModels?.length ? row.selectedModels : row.next.map(m => m.id) }
            ])
          }
        }
        result.applied = true
      }
      if (!dryRun || resultsToApply.length > 0) {
        const previousCatalogs = config.modelCatalogs ?? {}
        const patch = { modelLifecycle: nextLifecycle, lifecycleRevision: lifecycleRun }
        if (results.some((row) => row.changed) || Object.keys(previousCatalogs).length !== Object.keys(cachedCatalogs).length || JSON.stringify(previousCatalogs) !== JSON.stringify(cachedCatalogs)) patch.modelCatalogs = cachedCatalogs
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
      if (!dryRun || options.forceNotify) {
        try {
          const notifyResult = await dispatchDiffNotifications(ctx, config, results)
          if (notifyResult?.dispatched) {
            result.diffNotifications = notifyResult
          }
        } catch (err) {
          if (typeof ctx?.logger?.debug === "function") {
            ctx.logger.debug("[dsh-model-sync] dispatchDiffNotifications error:", err)
          }
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


  const pricingService = createPricingService({ ctx, getConfig, fetchImpl })
  const ollamaService = createOllamaService({ fetchImpl })
  const probingService = createProbingService({
    ctx,
    providers,
    health,
    selectAdapter,
    fetchImpl,
    probeModel,
  })
  const policyService = createPolicyService({
    ctx,
    getConfig,
    saveConfig,
    providers,
    getLastRun: () => lastRun,
  })

  const rollbackHistory = (opts) => performHistoryRollback({ ctx, config: getConfig() ?? {}, providers: providers(), ...opts })

  const transfer = createConfigTransfer({
    getConfig,
    saveConfig,
    listProviders: providers,
    validatePolicy,
    isCircuitOpen: (p) => Boolean(circuits.get(p)?.blockedUntil > Date.now()),
    getHealthResults: () => lastHealth?.results ?? [],
    getModelProbes: () => probingService.getModelProbes(),
  })

  const services = Object.freeze({
    stateStore,
    pricing: pricingService,
    ollama: ollamaService,
    probing: probingService,
    policy: policyService,
  })

  return Object.freeze({
    services,
    stateStore,
    listProviders: providers,
    getProvider: (provider) => providers().find((row) => row.provider === provider) ?? null,
    adapterRegistry: registry,
    registerAdapter: registry.register,
    discover,
    run,
    setModelSelection: policyService.setModelSelection,
    setModelPolicy: policyService.setModelPolicy,
    listPolicies,
    health,
    ...probingService,
    ...transfer,
    ...pricingService,
    ...ollamaService,
    credentialDiagnostics,
    history,
    report: () => structuredClone(lastReport),
    notifications: notificationLedger,
    updateNotification: updateNotificationState,
    rollbackHistory,
    testWebhook: policyService.testWebhook,
    status: () => ({
      running: Boolean(running),
      lastRun,
      lastHealth,
      lastReport: structuredClone(lastReport),
      notifications: notificationLedger(),
      history: history(),
      policies: listPolicies(),
      lifecycle: structuredClone(getConfig()?.modelLifecycle ?? {}),
      aliases: structuredClone(getConfig()?.aliases ?? {}),
      latencyRadar: probingService.getLatencyRadar(),
      capabilityProbing: probingService.getCapabilityStatus(),
    }),
  })
}
