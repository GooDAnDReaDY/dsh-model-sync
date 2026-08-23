import Schema from '@deepseek-ai/schemastery'
import { createProviderService } from './provider-service.js'

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
})

export function apply(ctx, config) {
  let liveConfig = Config(structuredClone(config || {}))
  const settings = ctx.get('settings')
  if (settings?.settings?.register) {
    const scope = settings.settings.register(NS, Config, { base: config })
    liveConfig = Config(scope.get() || config)
    ctx.effect(() => scope.onChange((next) => {
      liveConfig = Config(next || config)
    }), 'dsh-model-sync: settings')
  }

  const service = createProviderService(ctx)
  ctx.effect(() => {
    if (!liveConfig.enabled) return () => {}
    ctx.provide('modelSync', service)
    return () => {}
  }, 'dsh-model-sync: service')
}
