import { listApiKeyProviders } from './inventory.js'
import { createProviderAdapterRegistry } from './adapter-registry.js'
import { createCredentialResolver } from './credentials.js'
import { reconcileModels, catalogPatch } from './reconcile.js'

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

export function createModelSynchronizer(ctx, { getConfig = () => ({}), fetchImpl = fetch } = {}) {
  const resolveCredential = createCredentialResolver(ctx)
  const registry = createProviderAdapterRegistry({ resolveCredential, fetchImpl })
  let running = null
  let lastRun = null

  function providers() {
    return listApiKeyProviders(ctx.llm, settingsOf(ctx))
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
        const reconciliation = reconcileModels(row.provider, current, discovered.models, { removeMissing })
        results.push({ ...discovered, ...reconciliation, changed: reconciliation.changed })
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

  return Object.freeze({
    listProviders: providers,
    getProvider: (provider) => providers().find((row) => row.provider === provider) ?? null,
    discover,
    run,
    status: () => ({ running: Boolean(running), lastRun }),
  })
}
