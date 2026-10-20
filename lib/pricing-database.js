import fs from 'node:fs'
import path from 'node:path'

function cleanTokenPrice(val, { isPerToken = false } = {}) {
  const num = typeof val === 'string' ? Number(val.trim()) : val
  if (typeof num !== 'number' || !Number.isFinite(num) || num < 0) return 0
  if (isPerToken) {
    return Math.round(num * 1e12) / 1e12
  }
  return Math.round((num / 1000000) * 1e12) / 1e12
}

function perMillion(inputUSD, outputUSD, extra = {}) {
  const res = {
    inputPerToken: cleanTokenPrice(inputUSD),
    outputPerToken: cleanTokenPrice(outputUSD),
    currency: 'USD',
    source: 'reference',
  }
  if (extra.cacheReadUSD !== undefined) {
    res.cacheReadPerToken = cleanTokenPrice(extra.cacheReadUSD)
  }
  if (extra.cacheWriteUSD !== undefined) {
    res.cacheWritePerToken = cleanTokenPrice(extra.cacheWriteUSD)
  }
  return Object.freeze(res)
}

export const REFERENCE_PRICING = Object.freeze({
  openai: {
    'gpt-4o': perMillion(2.5, 10, { cacheReadUSD: 1.25 }),
    'gpt-4o-mini': perMillion(0.15, 0.6, { cacheReadUSD: 0.075 }),
    'gpt-4-turbo': perMillion(10, 30),
    'gpt-4': perMillion(30, 60),
    'gpt-3.5-turbo': perMillion(0.5, 1.5),
    'o1': perMillion(15, 60, { cacheReadUSD: 7.5 }),
    'o1-preview': perMillion(15, 60),
    'o1-mini': perMillion(1.1, 4.4, { cacheReadUSD: 0.55 }),
    'o3-mini': perMillion(1.1, 4.4, { cacheReadUSD: 0.55 }),
    'chatgpt-4o-latest': perMillion(5, 15),
  },
  anthropic: {
    'claude-3-7-sonnet': perMillion(3, 15, { cacheReadUSD: 0.3, cacheWriteUSD: 3.75 }),
    'claude-3-5-sonnet': perMillion(3, 15, { cacheReadUSD: 0.3, cacheWriteUSD: 3.75 }),
    'claude-3-5-haiku': perMillion(0.8, 4, { cacheReadUSD: 0.08, cacheWriteUSD: 1 }),
    'claude-3-opus': perMillion(15, 75, { cacheReadUSD: 1.5, cacheWriteUSD: 18.75 }),
    'claude-3-haiku': perMillion(0.25, 1.25, { cacheReadUSD: 0.025, cacheWriteUSD: 0.3 }),
  },
  groq: {
    'llama-3.3-70b-versatile': perMillion(0.59, 0.79),
    'llama-3.3-70b-specdec': perMillion(0.59, 0.99),
    'llama-3.1-70b-versatile': perMillion(0.59, 0.79),
    'llama-3.1-8b-instant': perMillion(0.05, 0.08),
    'llama3-70b-8192': perMillion(0.59, 0.79),
    'llama3-8b-8192': perMillion(0.05, 0.08),
    'mixtral-8x7b-32768': perMillion(0.24, 0.24),
    'gemma2-9b-it': perMillion(0.2, 0.2),
    'deepseek-r1-distill-llama-70b': perMillion(0.75, 0.99),
    'deepseek-r1-distill-qwen-32b': perMillion(0.59, 0.79),
    'qwen-2.5-32b': perMillion(0.59, 0.79),
    'qwen-2.5-coder-32b': perMillion(0.59, 0.79),
  },
  mistral: {
    'mistral-large': perMillion(2, 6),
    'mistral-small': perMillion(0.1, 0.3),
    'codestral': perMillion(0.3, 0.9),
    'ministral-8b': perMillion(0.1, 0.1),
    'ministral-3b': perMillion(0.04, 0.04),
    'pixtral-large': perMillion(2, 6),
    'pixtral-12b': perMillion(0.15, 0.15),
    'open-mistral-7b': perMillion(0.2, 0.2),
    'open-mixtral-8x7b': perMillion(0.7, 0.7),
  },
  xai: {
    'grok-2': perMillion(2, 10),
    'grok-2-mini': perMillion(0.2, 1),
    'grok-2-vision': perMillion(2, 10),
    'grok-beta': perMillion(5, 15),
  },
  deepseek: {
    'deepseek-chat': perMillion(0.14, 0.28, { cacheReadUSD: 0.014 }),
    'deepseek-reasoner': perMillion(0.55, 2.19, { cacheReadUSD: 0.14 }),
    'deepseek-coder': perMillion(0.14, 0.28),
  },
  google: {
    'gemini-2.0-flash': perMillion(0.1, 0.4),
    'gemini-1.5-pro': perMillion(1.25, 5),
    'gemini-1.5-flash': perMillion(0.075, 0.3),
    'gemini-1.5-flash-8b': perMillion(0.0375, 0.15),
  },
})

// Dynamic in-memory pricing store populated from OpenRouter / LiteLLM / disk cache
const DYNAMIC_PRICING = new Map()

export function getDynamicPricingMap() {
  return DYNAMIC_PRICING
}

export function clearDynamicPricing() {
  DYNAMIC_PRICING.clear()
}

export function setDynamicPricing(key, pricing) {
  if (!key || typeof key !== 'string' || !pricing) return
  DYNAMIC_PRICING.set(key.toLowerCase().trim(), Object.freeze({ ...pricing }))
}

function cleanId(id) {
  if (typeof id !== 'string') return ''
  return id
    .toLowerCase()
    .trim()
    .replace(/^models\//, '')
    .replace(/:latest$/, '')
    .replace(/-latest$/, '')
    .replace(/-(202\d{5}|202\d-\d{2}-\d{2}|\d{4})$/, '')
}

export function lookupReferencePricing(provider, modelId) {
  if (typeof modelId !== 'string' || !modelId.trim()) return undefined
  const provKey = String(provider || '').toLowerCase().trim()
  const rawId = modelId.toLowerCase().trim()
  const cleaned = cleanId(rawId)

  // 1. Dynamic pricing cache check (provider:modelId or rawId or cleaned)
  if (DYNAMIC_PRICING.size > 0) {
    const dynScoped = provKey ? DYNAMIC_PRICING.get(`${provKey}:${rawId}`) || DYNAMIC_PRICING.get(`${provKey}:${cleaned}`) : undefined
    if (dynScoped) return { ...dynScoped }
    const dynRaw = DYNAMIC_PRICING.get(rawId) || DYNAMIC_PRICING.get(cleaned)
    if (dynRaw) return { ...dynRaw }
  }

  // 2. Direct check in provider table (exact match or date-cleaned match)
  const table = REFERENCE_PRICING[provKey]
  if (table) {
    if (table[rawId]) return { ...table[rawId] }
    if (table[cleaned]) return { ...table[cleaned] }
    return undefined
  }

  // 3. Vendor prefix check (e.g. "openai/gpt-4o" or "anthropic/claude-3-5-sonnet")
  const slashIdx = rawId.indexOf('/')
  if (slashIdx > 0) {
    const subProv = rawId.slice(0, slashIdx)
    const subId = rawId.slice(slashIdx + 1)
    const subCleaned = cleanId(subId)
    const subTable = REFERENCE_PRICING[subProv]
    if (subTable) {
      if (subTable[subId]) return { ...subTable[subId] }
      if (subTable[subCleaned]) return { ...subTable[subCleaned] }
    }
  }

  // 4. Fallback search across tables ONLY for unknown/aggregator providers without a dedicated table
  for (const [p, t] of Object.entries(REFERENCE_PRICING)) {
    if (t[cleaned]) return { ...t[cleaned] }
  }

  return undefined
}

export function parseOpenRouterPricing(modelsData) {
  if (!Array.isArray(modelsData)) return []
  const results = []
  for (const item of modelsData) {
    if (!item?.id || !item?.pricing) continue
    const id = String(item.id).trim().toLowerCase()
    const p = item.pricing
    const inputPerToken = cleanTokenPrice(p.prompt, { isPerToken: true })
    const outputPerToken = cleanTokenPrice(p.completion, { isPerToken: true })
    const cacheReadPerToken = p.input_cache_read !== undefined || p.prompt_cached !== undefined
      ? cleanTokenPrice(p.input_cache_read ?? p.prompt_cached, { isPerToken: true })
      : undefined
    const cacheWritePerToken = p.input_cache_write !== undefined
      ? cleanTokenPrice(p.input_cache_write, { isPerToken: true })
      : undefined

    if (inputPerToken > 0 || outputPerToken > 0) {
      const entry = {
        inputPerToken,
        outputPerToken,
        ...(cacheReadPerToken !== undefined ? { cacheReadPerToken } : {}),
        ...(cacheWritePerToken !== undefined ? { cacheWritePerToken } : {}),
        currency: 'USD',
        source: 'openrouter',
      }
      results.push({ id, entry })
    }
  }
  return results
}

export async function fetchPricingUpdates({
  timeoutMs = 15000,
  fetchFn = globalThis.fetch,
  cachePath,
  logger,
} = {}) {
  let updatedCount = 0
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetchFn('https://openrouter.ai/api/v1/models', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    if (res.ok) {
      const json = await res.json()
      const entries = parseOpenRouterPricing(json?.data)
      for (const { id, entry } of entries) {
        DYNAMIC_PRICING.set(id, Object.freeze(entry))
        const clean = cleanId(id)
        if (clean && clean !== id) {
          DYNAMIC_PRICING.set(clean, Object.freeze(entry))
        }
        // Also index under vendor-prefixed subId
        const slashIdx = id.indexOf('/')
        if (slashIdx > 0) {
          const subId = id.slice(slashIdx + 1)
          DYNAMIC_PRICING.set(subId, Object.freeze(entry))
          const subClean = cleanId(subId)
          if (subClean && subClean !== subId) {
            DYNAMIC_PRICING.set(subClean, Object.freeze(entry))
          }
        }
        updatedCount++
      }

      if (cachePath && updatedCount > 0) {
        try {
          const serialized = JSON.stringify(Object.fromEntries(DYNAMIC_PRICING), null, 2)
          fs.writeFileSync(cachePath, serialized, 'utf-8')
        } catch (writeErr) {
          logger?.warn?.(`[dsh-model-sync] failed to write pricing cache: ${writeErr?.message}`)
        }
      }

      return { updated: updatedCount, source: 'openrouter', timestamp: Date.now() }
    }
  } catch (err) {
    logger?.warn?.(`[dsh-model-sync] live pricing fetch failed: ${err?.message}, falling back to cache`)
  } finally {
    clearTimeout(timer)
  }

  // Fallback: try loading cached pricing from disk
  if (cachePath && fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath, 'utf-8')
      const parsed = JSON.parse(data)
      for (const [k, v] of Object.entries(parsed)) {
        DYNAMIC_PRICING.set(k.toLowerCase().trim(), Object.freeze(v))
        updatedCount++
      }
      return { updated: updatedCount, source: 'cache', timestamp: Date.now() }
    } catch (readErr) {
      logger?.warn?.(`[dsh-model-sync] failed to read pricing cache: ${readErr?.message}`)
    }
  }

  return { updated: 0, source: 'reference', timestamp: Date.now() }
}
