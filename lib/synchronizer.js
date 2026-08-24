import { listApiKeyProviders } from './inventory.js'
import { createProviderAdapterRegistry } from './adapter-registry.js'
import { createCredentialResolver } from './credentials.js'
import { reconcileModels, catalogPatch } from './reconcile.js'
import { normalizeModels } from './models.js'

const PIAI_NS = 'llm-pi-ai'

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

  function providers() {
    const config = getConfig() ?? {}
    const lastResults = new Map((lastRun?.results ?? []).map((row) => [row.provider, row]))
    return listApiKeyProviders(ctx.llm, settingsOf(ctx)).map((row) => {
      const selection = Array.isArray(config.modelSelections?.[row.provider])
        ? [...new Set(config.modelSelections[row.provider].filter((id) => typeof id === 'string' && id))]
        : []
      const latest = lastResults.get(row.provider)
      return {
        ...row,
        selectedModels: selection,
        availableModels: latest?.status === 'ok' ? latest.availableModels ?? latest.models ?? row.models : row.models,
      }
    })
  }

  function selectionFor(config, provider) {
    const selection = config?.modelSelections?.[provider]
    return Array.isArray(selection) ? [...new Set(selection.filter((id) => typeof id === 'string' && id))] : []
  }

  async function discover(row, { signal } = {}) {
    const settings = settingsOf(ctx)
    const profile = { ...profileOf(settings, row.provider), provider: row.provider }
    const adapter = registry.select(profile)
    if (!adapter) return { provider: row.provider, status: 'unsupported', models: [], message: 'no supported API-key model adapter' }
    if (!profile.apiKeyEnv && !profile.baseURL) {
      return { provider: row.provider, status: 'dormant', models: [], message: 'provider has no API key route configured' }
    }
    try {
      const models = await adapter.discover(profile, { signal })
      return { provider: row.provider, status: 'ok', models }
    } catch (error) {
      return { provider: row.provider, status: 'error', models: [], message: errorMessage(error) }
    }
  }

  async function run(options = {}) {
    if (running) return running
    const config = getConfig() ?? {}
    const dryRun = options.dryRun !== false
    const removeMissing = options.removeMissing === true
    const selected = typeof options.provider === 'string' && options.provider
      ? providers().filter((row) => row.provider === options.provider)
      : providers().filter((row) => config.providers?.length === 0 || config.providers?.some((item) => item.provider === row.provider && item.enabled !== false))
    const startedAt = Date.now()
    const task = (async () => {
      const results = []
      for (const row of selected) {
        const discovered = await discover(row, options)
        if (discovered.status !== 'ok') {
          results.push({ ...discovered, changed: false })
          continue
        }
        const settings = settingsOf(ctx)
        const current = profileOf(settings, row.provider).models ?? row.models
        const selectedModels = selectionFor(config, row.provider)
        const advertised = selectedModels.length
          ? discovered.models.filter((model) => selectedModels.includes(model.id))
          : discovered.models
        const effectiveRemoveMissing = removeMissing || selectedModels.length > 0
        const reconciliation = reconcileModels(row.provider, current, advertised, { removeMissing: effectiveRemoveMissing })
        results.push({
          ...discovered,
          availableModels: discovered.models,
          selectedModels,
          advertised,
          ...reconciliation,
          removeMissing: effectiveRemoveMissing,
          changed: reconciliation.changed,
        })
      }
      const result = { startedAt, finishedAt: Date.now(), dryRun, removeMissing, results, applied: false }
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
      lastRun = result
      return result
    })()
    running = task.finally(() => { running = null })
    return running
  }

  async function setModelSelection(provider, models) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (!Array.isArray(models)) throw new Error('models must be an array')
    const selectedModels = [...new Set(models.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
    const config = getConfig() ?? {}
    const row = providers().find((item) => item.provider === provider)
    if (!row) throw Object.assign(new Error(`provider is not configured: ${provider}`), { code: 'PROVIDER_NOT_CONFIGURED' })
    const latest = lastRun?.results?.find((item) => item.provider === provider && item.status === 'ok')
    const available = normalizeModels(provider, latest?.availableModels ?? latest?.models ?? row.availableModels ?? row.models)
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
    await settings.replace(PIAI_NS, next, descriptor.revision)
    const modelSelections = { ...(config.modelSelections ?? {}), [provider]: selectedModels }
    await saveConfig({ modelSelections })
    return { provider, selectedModels, models: nextModels, availableModels: available, applied: true }
  }

  return Object.freeze({
    listProviders: providers,
    getProvider: (provider) => providers().find((row) => row.provider === provider) ?? null,
    discover,
    run,
    setModelSelection,
    status: () => ({ running: Boolean(running), lastRun }),
  })
}
