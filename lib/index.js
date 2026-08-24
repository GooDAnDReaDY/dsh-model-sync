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
  let liveConfig = Config(structuredClone(config || {}))
  let reconfigure = () => {}
  let saveConfig = async () => {
    throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
  }
  const settings = ctx.get('settings')
  if (settings?.settings?.register) {
    const scope = settings.settings.register(NS, Config, { base: config })
    liveConfig = Config(scope.get() || config)
    const watch = scope.watch ?? scope.onChange
    ctx.effect(() => watch?.call(scope, (next) => {
      liveConfig = Config(next || config)
      reconfigure()
    }), 'dsh-model-sync: settings')
    saveConfig = async (patch) => {
      if (typeof scope.update === 'function') return scope.update(patch)
      const next = { ...scope.get(), ...patch }
      if (typeof scope.replace === 'function') return scope.replace(next)
      throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
    }
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
