import Schema from '@deepseek-ai/schemastery'
import { createProviderService } from './provider-service.js'
import { createModelSynchronizer } from './synchronizer.js'
import { createSyncScheduler } from './scheduler.js'
import { registerHttpApi } from './http.js'

export const name = '@goodandready/dsh-model-sync'
export const inject = ['llm', 'settings', 'webServer', 'credentials']

const NS = 'dsh-model-sync'

export const Config = Schema.object({
  enabled: Schema.boolean().default(true),
  intervalMinutes: Schema.number().default(60),
  scheduleEnabled: Schema.boolean().default(false),
  jitterMinutes: Schema.number().default(0),
  ttlMinutes: Schema.number().default(0),
  autoApply: Schema.boolean().default(false),
  requestTimeoutMs: Schema.number().default(15000),
  retryAttempts: Schema.number().default(3),
  retryBaseDelayMs: Schema.number().default(250),
  retryMaxDelayMs: Schema.number().default(4000),
  concurrency: Schema.number().default(4),
  circuitBreakerFailures: Schema.number().default(3),
  circuitBreakerCooldownMinutes: Schema.number().default(5),
  historyLimit: Schema.number().default(50),
  notificationLimit: Schema.number().default(50),
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
  staleGraceRuns: Schema.number().default(2),
  lifecycleRetentionRuns: Schema.number().default(20),
  lifecycleRevision: Schema.number().default(0),
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
  })).default([]),
  modelSelections: Schema.dict(Schema.array(Schema.string())).default({}),
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

export function apply(ctx, config) {
  const baseConfig = structuredClone(config || {})
  const resolveConfig = (value) => Config(structuredClone(value || {}))
  let liveConfig = resolveConfig(baseConfig)
  let reconfigure = () => {}
  let saveConfigImpl
  // ctx.inject starts a child fiber; keep a stable function reference for the
  // synchronizer while that fiber connects to the Settings service.
  const saveConfig = async (patch) => {
    if (!saveConfigImpl) {
      throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
    }
    return saveConfigImpl(patch)
  }

  let settingsScope
  const bindSettings = (settings, ownerCtx) => {
    if (settingsScope || !settings?.register) return false
    const scope = settings.register(NS, Config, { base: baseConfig })
    settingsScope = scope
    liveConfig = resolveConfig(scope.get() || baseConfig)
    const stop = scope.watch((next) => {
      liveConfig = resolveConfig(next || baseConfig)
      reconfigure()
    })
    saveConfigImpl = async (patch) => {
      const result = await scope.update(patch)
      liveConfig = resolveConfig(scope.get() || baseConfig)
      return result
    }
    ownerCtx.effect(() => () => {
      settingsScope = undefined
      saveConfigImpl = undefined
      stop()
    }, 'dsh-model-sync: settings')
    return true
  }

  let settings
  try { settings = ctx.get('settings') } catch {}
  if (!bindSettings(settings, ctx)) {
    ctx.inject(['settings'], (sctx) => {
      bindSettings(sctx.settings, sctx)
    })
  }


  const service = createProviderService(ctx)
  const synchronizer = createModelSynchronizer(ctx, { getConfig: () => liveConfig, saveConfig })
  const scheduler = createSyncScheduler(synchronizer, { getConfig: () => liveConfig })
  reconfigure = () => scheduler.reconfigure()
  scheduler.start()
  ctx.effect(() => {
    const registrations = registerHttpApi(ctx, synchronizer, { getSchedulerStatus: () => scheduler.status() })
  ctx.effect(() => () => scheduler.stop(), 'dsh-model-sync: scheduler cleanup')
    return () => {
      for (const dispose of registrations) if (typeof dispose === 'function') dispose()
    }
  }, 'dsh-model-sync: http api')
  ctx.effect(() => {
    if (!liveConfig.enabled) return () => {}
    ctx.provide('modelSync', service)
    ctx.provide('modelSyncRunner', synchronizer)
    return () => {}
  }, 'dsh-model-sync: service')
}
