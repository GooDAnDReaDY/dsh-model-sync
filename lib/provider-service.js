import { listApiKeyProviders } from './inventory.js'
import { lookupReferenceLimits, lookupReferenceReasoning, clampOutputTokens, adaptReasoningPayload } from './specs-database.js'
import { deriveModelTags, isCuratedModel } from './models.js'
import { lookupReferencePricing } from './pricing-database.js'

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

  const getProvider = (provider) => listProviders().find((row) => row.provider === provider) ?? null

  const getLimits = (provider, modelId) => {
    const p = getProvider(provider)
    const catalog = Array.isArray(p?.models) ? p.models : []
    const found = catalog.find((m) => (m?.id === modelId || m?.name === modelId))
    if (found && (found.contextWindow !== undefined || found.maxOutputTokens !== undefined || found.maxTokens !== undefined)) {
      return {
        contextWindow: found.contextWindow,
        maxOutputTokens: found.maxOutputTokens ?? found.maxTokens,
      }
    }
    return lookupReferenceLimits(provider, modelId) ?? null
  }

  const clampCompletionTokens = (provider, modelId, requestedTokens) => {
    const limits = getLimits(provider, modelId)
    return clampOutputTokens(limits?.maxOutputTokens, requestedTokens)
  }

  const getReasoningConfig = (provider, modelId) => {
    const p = getProvider(provider)
    const catalog = Array.isArray(p?.models) ? p.models : []
    const found = catalog.find((m) => (m?.id === modelId || m?.name === modelId))
    if (found?.reasoningConfig) {
      return found.reasoningConfig
    }
    return lookupReferenceReasoning(provider, modelId) ?? null
  }

  const adaptReasoning = (provider, modelId, options = {}) => {
    const p = getProvider(provider)
    const catalog = Array.isArray(p?.models) ? p.models : []
    const found = catalog.find((m) => (m?.id === modelId || m?.name === modelId)) || {
      provider,
      id: modelId,
      reasoningConfig: getReasoningConfig(provider, modelId),
    }
    return adaptReasoningPayload(found, options)
  }

  const getPricing = (provider, modelId) => {
    const p = getProvider(provider)
    const catalog = Array.isArray(p?.models) ? p.models : []
    const found = catalog.find((m) => (m?.id === modelId || m?.name === modelId))
    if (found?.pricing) return found.pricing
    return lookupReferencePricing(provider, modelId) ?? null
  }

  const getTags = (provider, modelId) => {
    const p = getProvider(provider)
    const catalog = Array.isArray(p?.models) ? p.models : []
    const found = catalog.find((m) => (m?.id === modelId || m?.name === modelId))
    if (found?.tags && found.tags.length > 0) return found.tags
    if (found) return deriveModelTags(found)
    return deriveModelTags({ provider, id: modelId })
  }

  const isCurated = (provider, modelId) => {
    const p = getProvider(provider)
    const catalog = Array.isArray(p?.models) ? p.models : []
    const found = catalog.find((m) => (m?.id === modelId || m?.name === modelId))
    return isCuratedModel(found || { provider, id: modelId })
  }


  const getVerifiedCapabilities = (provider, modelId) => {
    try {
      const runner = ctx?.reflect?.get?.('modelSyncRunner') ?? (typeof ctx?.get === 'function' ? ctx.get('modelSyncRunner') : undefined)
      if (runner && typeof runner.getVerifiedCapabilities === 'function') {
        return runner.getVerifiedCapabilities({ provider, model: modelId })
      }
    } catch {
      // ignore
    }
    return null
  }

  return Object.freeze({
    listProviders,
    getProvider,
    getLimits,
    clampCompletionTokens,
    getReasoningConfig,
    adaptReasoningPayload: adaptReasoning,
    getPricing,
    getTags,
    isCurated,
    getVerifiedCapabilities,
  })
}
