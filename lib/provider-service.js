import { listApiKeyProviders } from './inventory.js'

export function createProviderService(ctx) {
  const readSettings = () => {
    try {
      return ctx?.settings ?? ctx?.reflect?.get?.('settings') ?? (typeof ctx?.get === 'function' ? ctx.get('settings') : undefined)
    } catch {
      return undefined
    }
  }

  const readLlm = () => {
    try {
      const llm = ctx?.llm ?? ctx?.reflect?.get?.('llm') ?? (typeof ctx?.get === 'function' ? ctx.get('llm') : null)
      return (llm && typeof llm === 'object' && (llm.listConfigurableProviders || llm.listProviders)) ? llm : undefined
    } catch {
      return undefined
    }
  }

  const listProviders = () => listApiKeyProviders(readLlm(), readSettings())

  return Object.freeze({
    listProviders,
    getProvider(provider) {
      return listProviders().find((row) => row.provider === provider) ?? null
    },
  })
}
