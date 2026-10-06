function cleanTokenPrice(val) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0
  return Math.round((val / 1000000) * 1e12) / 1e12
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
    'gpt-4o': perMillion(2.5, 10),
    'gpt-4o-mini': perMillion(0.15, 0.6),
    'gpt-4-turbo': perMillion(10, 30),
    'gpt-4': perMillion(30, 60),
    'gpt-3.5-turbo': perMillion(0.5, 1.5),
    'o1': perMillion(15, 60),
    'o1-preview': perMillion(15, 60),
    'o1-mini': perMillion(1.1, 4.4),
    'o3-mini': perMillion(1.1, 4.4),
    'chatgpt-4o-latest': perMillion(5, 15),
  },
  anthropic: {
    'claude-3-7-sonnet': perMillion(3, 15),
    'claude-3-5-sonnet': perMillion(3, 15),
    'claude-3-5-haiku': perMillion(0.8, 4),
    'claude-3-opus': perMillion(15, 75),
    'claude-3-haiku': perMillion(0.25, 1.25),
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

  // 1. Direct check in provider table (exact match or date-cleaned match)
  const table = REFERENCE_PRICING[provKey]
  if (table) {
    if (table[rawId]) return { ...table[rawId] }
    if (table[cleaned]) return { ...table[cleaned] }
    // If the provider has a dedicated pricing table, do not search other providers' tables
    return undefined
  }

  // 2. Vendor prefix check (e.g. "openai/gpt-4o" or "anthropic/claude-3-5-sonnet")
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

  // 3. Fallback search across tables ONLY for unknown/aggregator providers without a dedicated table
  for (const [p, t] of Object.entries(REFERENCE_PRICING)) {
    if (t[cleaned]) return { ...t[cleaned] }
  }

  return undefined
}
