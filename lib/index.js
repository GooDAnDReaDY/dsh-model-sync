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
  autoApply: Schema.boolean().default(false),
  providers: Schema.array(Schema.object({
    provider: Schema.string().required(),
    enabled: Schema.boolean().default(true),
  })).default([]),
  modelSelections: Schema.dict(Schema.array(Schema.string())).default({}),
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
    const registrations = registerHttpApi(ctx, synchronizer)
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
