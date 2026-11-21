/**
 * DeepSeek Harness Model Sync — Pricing Domain Service (#280)
 */

import path from 'node:path'
import {
  fetchPricingUpdates,
  lookupReferencePricing,
  getDynamicPricingMap,
  clearDynamicPricing,
  setDynamicPricing,
} from '../pricing-database.js'
import { resolveStateDir } from '../state-store.js'

export function createPricingService({ ctx = null, getConfig = () => ({}), fetchImpl = fetch } = {}) {
  async function syncPricing({ reset = false } = {}) {
    if (reset) clearDynamicPricing()
    const config = getConfig() ?? {}
    const timeoutMs = config.requestTimeoutMs ?? 15000
    const cachePath = path.join(resolveStateDir(), 'pricing-cache.json')
    return await fetchPricingUpdates({ timeoutMs, fetchFn: fetchImpl, cachePath, logger: ctx?.logger })
  }

  function resetPricingCache() {
    clearDynamicPricing()
  }

  function setPricingOverride(key, pricing) {
    return setDynamicPricing(key, pricing)
  }

  function getPricingInfo({ provider, model } = {}) {
    if (provider && model) {
      return { provider, model, pricing: lookupReferencePricing(provider, model) }
    }
    const dynamic = Object.fromEntries(getDynamicPricingMap())
    return {
      dynamicCount: Object.keys(dynamic).length,
      sample: dynamic,
    }
  }

  return Object.freeze({
    syncPricing,
    resetPricingCache,
    setPricingOverride,
    getPricingInfo,
  })
}
