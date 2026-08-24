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
})

export function apply(ctx, config) {
  const baseConfig = structuredClone(config || {})
  let liveConfig = Config(baseConfig)
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

  // The settings capability is injected as sctx.settings; ctx.get('settings')
  // returns the provider service and does not expose the register API.
  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, Config, { base: baseConfig })
    liveConfig = Config(scope.get() || baseConfig)
    const stop = scope.watch((next) => {
      liveConfig = Config(next || baseConfig)
      reconfigure()
    })
    saveConfigImpl = async (patch) => {
      const result = await scope.update(patch)
      // Settings watchers are serialized asynchronously; refresh the snapshot
      // synchronously as well so a following request sees the new allowlist.
      liveConfig = Config(scope.get() || baseConfig)
      return result
    }
    sctx.effect(() => () => {
      saveConfigImpl = undefined
      stop()
    }, 'dsh-model-sync: settings')
  })

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
