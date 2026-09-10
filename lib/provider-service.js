import { listApiKeyProviders } from './inventory.js'

export function createProviderService(ctx) {
  const readSettings = () => {
    try {
      return (typeof ctx.get === 'function' ? (ctx.get('settings') ?? ctx.settings) : ctx.settings)
    } catch {
      return ctx.settings
    }
  }

  const readLlm = () => {
    try {
      const llm = typeof ctx.get === 'function' ? ctx.get('llm') : null
      return (llm && typeof llm === 'object' && (llm.listConfigurableProviders || llm.listProviders)) ? llm : ctx.llm
    } catch {
      return ctx.llm
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
