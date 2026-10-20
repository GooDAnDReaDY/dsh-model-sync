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

export const REFERENCE_SPECS = Object.freeze({
  openai: {
    'gpt-4o': { contextWindow: 128000, maxOutputTokens: 16384 },
    'gpt-4o-mini': { contextWindow: 128000, maxOutputTokens: 16384 },
    'o1': {
      contextWindow: 200000,
      maxOutputTokens: 100000,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'effort', defaultEffort: 'medium', supportedEfforts: ['low', 'medium', 'high'] },
      compat: { supportsTemperature: false, supportsMaxTokens: false },
    },
    'o1-preview': {
      contextWindow: 128000,
      maxOutputTokens: 32768,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'effort', defaultEffort: 'medium', supportedEfforts: ['low', 'medium', 'high'] },
      compat: { supportsTemperature: false, supportsMaxTokens: false },
    },
    'o1-mini': {
      contextWindow: 128000,
      maxOutputTokens: 65536,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'effort', defaultEffort: 'medium', supportedEfforts: ['low', 'medium', 'high'] },
      compat: { supportsTemperature: false, supportsMaxTokens: false },
    },
    'o3-mini': {
      contextWindow: 200000,
      maxOutputTokens: 100000,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'effort', defaultEffort: 'medium', supportedEfforts: ['low', 'medium', 'high'] },
      compat: { supportsTemperature: false, supportsMaxTokens: false },
    },
    'gpt-4-turbo': { contextWindow: 128000, maxOutputTokens: 4096 },
    'gpt-4': { contextWindow: 8192, maxOutputTokens: 4096 },
    'gpt-3.5-turbo': { contextWindow: 16385, maxOutputTokens: 4096 },
    'chatgpt-4o-latest': { contextWindow: 128000, maxOutputTokens: 16384 },
  },
  anthropic: {
    'claude-3-7-sonnet': {
      contextWindow: 200000,
      maxOutputTokens: 64000,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'budget_tokens', defaultBudget: 4096, maxBudget: 64000 },
    },
    'claude-3-5-sonnet': { contextWindow: 200000, maxOutputTokens: 8192 },
    'claude-3-5-haiku': { contextWindow: 200000, maxOutputTokens: 8192 },
    'claude-3-opus': { contextWindow: 200000, maxOutputTokens: 4096 },
    'claude-3-haiku': { contextWindow: 200000, maxOutputTokens: 4096 },
  },
  deepseek: {
    'deepseek-chat': { contextWindow: 64000, maxOutputTokens: 8192 },
    'deepseek-reasoner': {
      contextWindow: 64000,
      maxOutputTokens: 8192,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'boolean' },
    },
    'deepseek-coder': { contextWindow: 16384, maxOutputTokens: 4096 },
  },
  google: {
    'gemini-2.0-flash': { contextWindow: 1048576, maxOutputTokens: 8192 },
    'gemini-2.0-flash-thinking-exp': {
      contextWindow: 1048576,
      maxOutputTokens: 65536,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'budget_tokens', defaultBudget: 8192, maxBudget: 65536 },
    },
    'gemini-2.0-flash-lite': { contextWindow: 1048576, maxOutputTokens: 8192 },
    'gemini-1.5-pro': { contextWindow: 2097152, maxOutputTokens: 8192 },
    'gemini-1.5-flash': { contextWindow: 1048576, maxOutputTokens: 8192 },
    'gemini-1.5-flash-8b': { contextWindow: 1048576, maxOutputTokens: 8192 },
  },
  groq: {
    'llama-3.3-70b-versatile': { contextWindow: 131072, maxOutputTokens: 32768 },
    'llama-3.3-70b-specdec': { contextWindow: 8192, maxOutputTokens: 8192 },
    'llama-3.1-70b-versatile': { contextWindow: 131072, maxOutputTokens: 32768 },
    'llama-3.1-8b-instant': { contextWindow: 131072, maxOutputTokens: 8192 },
    'llama3-70b-8192': { contextWindow: 8192, maxOutputTokens: 8192 },
    'llama3-8b-8192': { contextWindow: 8192, maxOutputTokens: 8192 },
    'mixtral-8x7b-32768': { contextWindow: 32768, maxOutputTokens: 32768 },
    'gemma2-9b-it': { contextWindow: 8192, maxOutputTokens: 8192 },
    'deepseek-r1-distill-llama-70b': {
      contextWindow: 131072,
      maxOutputTokens: 32768,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'budget_tokens', defaultBudget: 4096, maxBudget: 32768 },
    },
    'deepseek-r1-distill-qwen-32b': {
      contextWindow: 131072,
      maxOutputTokens: 32768,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'budget_tokens', defaultBudget: 4096, maxBudget: 32768 },
    },
    'qwen-2.5-32b': { contextWindow: 131072, maxOutputTokens: 8192 },
    'qwen-2.5-coder-32b': { contextWindow: 131072, maxOutputTokens: 8192 },
    'qwen-qwq-32b': {
      contextWindow: 131072,
      maxOutputTokens: 32768,
      reasoningConfig: { supportsReasoning: true, paramFormat: 'budget_tokens', defaultBudget: 4096, maxBudget: 32768 },
    },
  },
  xai: {
    'grok-2': { contextWindow: 131072, maxOutputTokens: 8192 },
    'grok-2-mini': { contextWindow: 131072, maxOutputTokens: 8192 },
    'grok-2-vision': { contextWindow: 131072, maxOutputTokens: 8192 },
    'grok-beta': { contextWindow: 131072, maxOutputTokens: 8192 },
  },
  mistral: {
    'mistral-large': { contextWindow: 128000, maxOutputTokens: 8192 },
    'mistral-small': { contextWindow: 128000, maxOutputTokens: 8192 },
    'codestral': { contextWindow: 256000, maxOutputTokens: 8192 },
    'ministral-8b': { contextWindow: 128000, maxOutputTokens: 8192 },
    'ministral-3b': { contextWindow: 128000, maxOutputTokens: 8192 },
    'pixtral-large': { contextWindow: 128000, maxOutputTokens: 8192 },
    'pixtral-12b': { contextWindow: 128000, maxOutputTokens: 8192 },
  },
})

export function lookupReferenceSpec(provider, modelId) {
  if (typeof modelId !== 'string' || !modelId.trim()) return undefined
  const provKey = String(provider || '').toLowerCase().trim()
  const rawId = modelId.toLowerCase().trim()
  const cleaned = cleanId(rawId)

  // 1. Direct provider match
  const table = REFERENCE_SPECS[provKey]
  if (table) {
    if (table[rawId]) return { ...table[rawId] }
    if (table[cleaned]) return { ...table[cleaned] }
    return undefined
  }

  // 2. Slash prefix (e.g. "anthropic/claude-3-7-sonnet" or "openai/o3-mini")
  const slashIdx = rawId.indexOf('/')
  if (slashIdx > 0) {
    const subProv = rawId.slice(0, slashIdx)
    const subId = rawId.slice(slashIdx + 1)
    const subCleaned = cleanId(subId)
    const subTable = REFERENCE_SPECS[subProv]
    if (subTable) {
      if (subTable[subId]) return { ...subTable[subId] }
      if (subTable[subCleaned]) return { ...subTable[subCleaned] }
    }
  }

  // 3. Fallback across all tables for aggregators (OpenRouter, ClineBot, CommandCode)
  for (const [, t] of Object.entries(REFERENCE_SPECS)) {
    if (t[rawId]) return { ...t[rawId] }
    if (t[cleaned]) return { ...t[cleaned] }
  }

  return undefined
}

export function lookupReferenceLimits(provider, modelId) {
  const spec = lookupReferenceSpec(provider, modelId)
  if (!spec) return undefined
  const res = {}
  if (spec.contextWindow !== undefined) res.contextWindow = spec.contextWindow
  if (spec.maxOutputTokens !== undefined) res.maxOutputTokens = spec.maxOutputTokens
  return Object.keys(res).length > 0 ? res : undefined
}

export function lookupReferenceReasoning(provider, modelId) {
  const spec = lookupReferenceSpec(provider, modelId)
  return spec?.reasoningConfig ? structuredClone(spec.reasoningConfig) : undefined
}

export function lookupReferenceCompat(provider, modelId) {
  const spec = lookupReferenceSpec(provider, modelId)
  return spec?.compat ? structuredClone(spec.compat) : undefined
}

export function clampOutputTokens(modelOrLimit, requestedTokens) {
  const limit = typeof modelOrLimit === 'number'
    ? modelOrLimit
    : Number(modelOrLimit?.maxOutputTokens ?? modelOrLimit?.maxTokens)
  if (!Number.isFinite(limit) || limit <= 0) {
    return { clamped: false, value: requestedTokens, limit: undefined }
  }
  const requested = Number(requestedTokens)
  if (!Number.isFinite(requested) || requested <= 0) {
    return { clamped: false, value: requestedTokens, limit }
  }
  if (requested > limit) {
    return { clamped: true, value: limit, original: requested, limit }
  }
  return { clamped: false, value: requested, limit }
}

export function adaptReasoningPayload(model, userOptions = {}) {
  const warnings = []
  const payload = {}
  const config = model?.reasoningConfig
  const format = config?.paramFormat || 'none'
  const compat = model?.compat || {}

  if (format === 'effort') {
    const effort = userOptions.reasoningEffort || config?.defaultEffort || 'medium'
    payload.reasoning_effort = effort
    if (compat.supportsTemperature === false && userOptions.temperature !== undefined && userOptions.temperature !== 1) {
      warnings.push(`temperature ${userOptions.temperature} is not supported by model ${model.id}; omitted`)
    }
    if (compat.supportsMaxTokens === false && userOptions.maxTokens !== undefined) {
      payload.max_completion_tokens = userOptions.maxTokens
    }
  } else if (format === 'budget_tokens') {
    const maxBudget = config?.maxBudget || 64000
    const defaultBudget = config?.defaultBudget || 4096
    const budget = Math.min(Math.max(1, Number(userOptions.thinkingBudget || defaultBudget)), maxBudget)
    if (model?.provider === 'google' || String(model?.id || '').startsWith('gemini')) {
      payload.thinking_config = { thinking_budget: budget }
    } else {
      payload.thinking = { type: 'enabled', budget_tokens: budget }
    }
  } else if (format === 'boolean') {
    payload.thinking = true
  }

  return { payload, warnings, format }
}
