import { listApiKeyProviders } from './inventory.js'

export function createProviderService(ctx) {
  const readSettings = () => {
    try {
      return ctx.get('settings')
    } catch {
      return undefined
    }
  }

  const listProviders = () => listApiKeyProviders(ctx.llm, readSettings())

  return Object.freeze({
    listProviders,
    getProvider(provider) {
      return listProviders().find((row) => row.provider === provider) ?? null
    },
  })
}
