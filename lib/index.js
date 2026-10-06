import Schema from '@deepseek-ai/schemastery'
import { createProviderService } from './provider-service.js'
import { createModelSynchronizer } from './synchronizer.js'
import { createSyncScheduler } from './scheduler.js'
import { registerHttpApi } from './http.js'
import { registerPluginUpdater } from './updater.js'

export const name = '@goodandready/dsh-model-sync'
export const inject = ['llm', 'webServer', 'credentials']

const NS = 'dsh-model-sync'

export const Config = Schema.object({
  enabled: Schema.boolean().default(true).volatile(),
  intervalMinutes: Schema.number().default(60).volatile(),
  scheduleEnabled: Schema.boolean().default(false).volatile(),
  jitterMinutes: Schema.number().default(0).volatile(),
  ttlMinutes: Schema.number().default(0).volatile(),
  autoApply: Schema.boolean().default(false).volatile(),
  requestTimeoutMs: Schema.number().default(15000).volatile(),
  retryAttempts: Schema.number().default(3).volatile(),
  retryBaseDelayMs: Schema.number().default(250).volatile(),
  retryMaxDelayMs: Schema.number().default(4000).volatile(),
  concurrency: Schema.number().default(4).volatile(),
  circuitBreakerFailures: Schema.number().default(3).volatile(),
  circuitBreakerCooldownMinutes: Schema.number().default(5).volatile(),
  historyLimit: Schema.number().default(50).volatile(),
  notificationLimit: Schema.number().default(50).volatile(),
  diffWebhookUrl: Schema.string().default().volatile(),
  diffWebhookSecretRef: Schema.string().role('credential-ref').default('').volatile(),
  diffWebhookSecret: Schema.string().role('credential-ref').default('').volatile(),
  notifyOnModelAdded: Schema.boolean().default(true).volatile(),
  notifyOnModelDeprecated: Schema.boolean().default(true).volatile(),
  notifyOnPriceChanged: Schema.boolean().default(true).volatile(),
  notifications: Schema.array(Schema.object({
    id: Schema.string().required(),
    fingerprint: Schema.string().required(),
    createdAt: Schema.number().required(),
    updatedAt: Schema.number().required(),
    occurrences: Schema.number().default(1),
    readAt: Schema.any().default(null),
    acknowledgedAt: Schema.any().default(null),
    severity: Schema.string().required(),
    title: Schema.string().required(),
    message: Schema.string().required(),
    providers: Schema.array(Schema.object({}).loose()).default([]),
  }).loose()).default([]),
  staleGraceRuns: Schema.number().default(2).volatile(),
  lifecycleRetentionRuns: Schema.number().default(20).volatile(),
  lifecycleRevision: Schema.number().default(0).volatile(),
  modelLifecycle: Schema.dict(Schema.dict(Schema.object({
    status: Schema.string().required(),
    consecutiveMissing: Schema.number().default(0),
    firstMissingAt: Schema.number().default(0),
    lastSeenAt: Schema.number().default(0),
    lastObservedRun: Schema.number().default(0),
  }).loose())).default({}),
  history: Schema.array(Schema.object({
    id: Schema.string().required(),
    version: Schema.number().required(),
    startedAt: Schema.number().required(),
    finishedAt: Schema.number().required(),
    providers: Schema.array(Schema.object({}).loose()).default([]),
  }).loose()).default([]),
  providers: Schema.array(Schema.object({
    provider: Schema.string().required(),
    enabled: Schema.boolean().default(true),
    intervalMinutes: Schema.number().default(0),
    jitterMinutes: Schema.number().default(0),
    ttlMinutes: Schema.number().default(0),
    autoApply: Schema.boolean().default(false),
  })).default([]),
  aliases: Schema.dict(Schema.object({
    provider: Schema.string(),
    model: Schema.string(),
    targets: Schema.array(Schema.object({
      provider: Schema.string().required(),
      model: Schema.string().required(),
    })),
    strategy: Schema.string(),
    updatedAt: Schema.number().default(0),
  }).loose()).default({}),
  modelSelections: Schema.dict(Schema.array(Schema.string())).default({}).volatile(),
  adapterRegistry: Schema.dict(Schema.object({
    enabled: Schema.boolean().default(true),
    endpoint: Schema.string().default(''),
    auth: Schema.string().default('bearer'),
    parser: Schema.string().default('openai'),
    modelsPath: Schema.string().default('data'),
    fields: Schema.any().default({}),
    capabilityMap: Schema.any().default({}),
    headers: Schema.dict(Schema.string()).default({}),
  }).loose()).default({}),
  modelPolicies: Schema.dict(Schema.object({
    include: Schema.array(Schema.string()).default([]),
    exclude: Schema.array(Schema.string()).default([]),
    requireCapabilities: Schema.dict(Schema.boolean()).default({}),
    denyCapabilities: Schema.dict(Schema.boolean()).default({}),
    enableCostFilter: Schema.boolean().default(false),
    maxPricePerMillion: Schema.number(),
    enableContextFilter: Schema.boolean().default(false),
    minContextTokens: Schema.number(),
  }).loose()).default({}),
  // Full catalogs are cached separately from the allowlist applied to DSH.
  // This keeps the model picker useful after a restart without widening the
  // active llm-pi-ai catalog.
  modelCatalogs: Schema.dict(Schema.array(Schema.object({
    provider: Schema.string().required(),
    id: Schema.string().required(),
    name: Schema.string().required(),
  }).loose())).default({}),
})

// DSH serves a namespace's settings form from the volatile fields of its profile
// entry schema, and a volatile field holds a Volatile box rather than its value.
// Unwrap before any caller reads one, and read lazily: the Loader mutates the
// boxes in place and re-announces them with loader/volatile-update.
export function plainConfig(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(plainConfig)
  if (typeof value.get === 'function') return plainConfig(value.get())
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainConfig(v)]))
}

export function apply(ctx, config) {
  const baseConfig = structuredClone(plainConfig(config || {}))
  const resolveConfig = (value) => {
    try {
      return plainConfig(Config(plainConfig(value) || {}))
    } catch (err) {
      if (typeof ctx?.logger?.warn === "function") {
        ctx.logger.warn("[dsh-model-sync] invalid config payload, fallback to current config:", err?.message || err)
      }
      return liveConfig ?? baseConfig
    }
  }
  let liveConfig = resolveConfig(baseConfig)
  let reconfigure = () => {}
  let saveConfigImpl = async (patch) => {
    const plainPatch = plainConfig(patch)
    let settings
    try {
      settings = (typeof ctx.get === 'function' ? ctx.get('settings') : null) ?? ctx.settings
    } catch (err) {
      if (typeof ctx.logger?.debug === 'function') {
        ctx.logger.debug('[dsh-model-sync] settings service read failed:', err)
      }
    }
    if (settings && typeof settings.update === 'function') {
      try {
        await settings.update(NS, plainPatch)
      } catch (err) {
        if (typeof ctx.logger?.warn === 'function') {
          ctx.logger.warn('[dsh-model-sync] settings.update failed:', err)
        }
      }
    }
    liveConfig = resolveConfig({ ...liveConfig, ...plainPatch })
    reconfigure()
    return liveConfig
  }

  // ctx.inject starts a child fiber; keep a stable function reference for the
  // synchronizer while that fiber connects to the Settings service.
  const saveConfig = async (patch) => {
    if (!saveConfigImpl) {
      throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
    }
    return saveConfigImpl(patch)
  }

  const service = createProviderService(ctx)
  const synchronizer = createModelSynchronizer(ctx, { getConfig: () => liveConfig, saveConfig })
  const scheduler = createSyncScheduler(synchronizer, { getConfig: () => liveConfig })
  reconfigure = () => scheduler.reconfigure()
  scheduler.start()

  ctx.effect(() => {
    if (typeof ctx.on !== 'function') return () => {}
    const dispose = ctx.on('loader/volatile-update', () => {
      liveConfig = resolveConfig(config)
      reconfigure()
    })
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  }, 'dsh-model-sync: volatile-update listener')

  // settings.register was removed before 0.1.7-rc.2. The host hands the profile entry
  // config to apply() directly, and liveConfig above is derived from it; the
  // Loader mutates the boxes in place and re-announces them with
  // loader/volatile-update.
  ctx.effect(() => () => scheduler.stop(), 'dsh-model-sync: scheduler cleanup')
  ctx.effect(() => {
    const registrations = registerHttpApi(ctx, synchronizer, { getSchedulerStatus: () => scheduler.status() })
    return () => {
      for (const dispose of registrations) if (typeof dispose === 'function') dispose()
    }
  }, 'dsh-model-sync: http api')
  ctx.effect(() => registerPluginUpdater(ctx, {
    packageName: name,
    endpoint: '/api/dsh-model-sync/update',
    manifestUrl: new URL('../package.json', import.meta.url),
  }), 'dsh-model-sync: plugin updater')
  ctx.effect(() => {
    ctx.provide('modelSync', service)
    ctx.provide('modelSyncRunner', synchronizer)
    return () => {}
  }, 'dsh-model-sync: service')
}
