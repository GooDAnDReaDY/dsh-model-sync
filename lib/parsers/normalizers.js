import { lookupReferencePricing } from '../pricing-database.js'
import { lookupReferenceLimits, lookupReferenceReasoning, lookupReferenceCompat } from '../specs-database.js'
const FIELD_ALIASES = Object.freeze({
  contextWindow: [
    'contextWindow', 'context_window', 'contextLength', 'context_length',
    'maxContextTokens', 'max_context_tokens', 'maxContextLength', 'max_context_length',
    'inputTokenLimit', 'input_token_limit',
    'top_provider.context_length', 'topProvider.contextLength',
  ],
  maxTokens: [
    'maxTokens', 'max_tokens', 'max_output_tokens', 'maxOutputTokens',
    'outputTokenLimit', 'output_token_limit',
    'max_completion_tokens', 'maxCompletionTokens',
    'top_provider.max_completion_tokens', 'topProvider.maxCompletionTokens',
  ],
  maxOutputTokens: [
    'maxOutputTokens', 'max_output_tokens', 'maxTokens', 'max_tokens',
    'outputTokenLimit', 'output_token_limit',
    'max_completion_tokens', 'maxCompletionTokens',
    'top_provider.max_completion_tokens', 'topProvider.maxCompletionTokens',
  ],
})

const CAPABILITY_ALIASES = Object.freeze({
  vision: ['vision', 'supportsVision', 'supports_vision', 'imageInput', 'image_input'],
  tools: ['tools', 'toolUse', 'tool_use', 'functionCalling', 'function_calling', 'supportsTools', 'supports_tools'],
  reasoning: ['reasoning', 'supportsReasoning', 'supports_reasoning', 'thinking', 'extendedThinking', 'extended_thinking'],
  embeddings: ['embeddings', 'embedding', 'supportsEmbeddings', 'supports_embeddings'],
  code: ['code', 'supportsCode', 'supports_code', 'coding', 'codeSpecialized', 'code_specialized'],
})

const CAPABILITY_TOKENS = Object.freeze({
  vision: new Set(['vision', 'image', 'imageinput', 'multimodal', 'visioninput']),
  tools: new Set(['tools', 'tooluse', 'toolchoice', 'functioncalling', 'functioncall', 'functions']),
  reasoning: new Set(['reasoning', 'reasoningeffort', 'thinking', 'extendedthinking', 'thought', 'cot']),
  embeddings: new Set(['embedding', 'embeddings']),
  code: new Set(['code', 'coding', 'codespecialized', 'codegen']),
})

const ID_ALIASES = Object.freeze(['aliases', 'alias', 'previousIds', 'previous_ids', 'previousId', 'previous_id'])

const PRICING_ALIASES = Object.freeze({
  inputPerToken: ['inputPerToken', 'input_per_token', 'inputPricePerToken', 'input_price_per_token', 'inputTokenPrice', 'input_token_price'],
  outputPerToken: ['outputPerToken', 'output_per_token', 'outputPricePerToken', 'output_price_per_token', 'outputTokenPrice', 'output_token_price'],
  cacheReadPerToken: ['cacheReadPerToken', 'cache_read_per_token', 'cacheReadPricePerToken', 'cache_read_price_per_token', 'cachedInputPerToken', 'cached_input_per_token'],
  cacheWritePerToken: ['cacheWritePerToken', 'cache_write_per_token', 'cacheWritePricePerToken', 'cache_write_price_per_token'],
})

function numericValue(value, { allowZero = false } = {}) {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  const clean = typeof value === 'string' ? value.trim().replace(/,/g, '') : value
  let number = Number(clean)
  if (typeof clean === 'string' && !Number.isFinite(number)) {
    const match = clean.match(/^(\d+(?:\.\d+)?)\s*([kmgt])(i?b)?$/i)
    if (match) {
      const base = Number(match[1])
      const unit = match[2].toLowerCase()
      const isBinary = Boolean(match[3] && match[3].toLowerCase().startsWith('i'))
      const mult = unit === 'k' ? (isBinary ? 1024 : 1000)
        : unit === 'm' ? (isBinary ? 1048576 : 1000000)
        : unit === 'g' ? (isBinary ? 1073741824 : 1000000000)
        : 1
      number = Math.round(base * mult)
    }
  }
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) return undefined
  return number
}

function firstNumber(row, fields, options) {
  for (const field of fields) {
    let value
    if (field.includes('.')) {
      value = field.split('.').reduce((acc, k) => (acc && typeof acc === 'object') ? acc[k] : undefined, row)
    } else {
      value = row?.[field]
    }
    const val = numericValue(value, options)
    if (val !== undefined) return val
  }
  return undefined
}

function booleanValue(value) {
  if (value === true || value === false) return value
  if (typeof value !== 'string') return undefined
  if (value.trim().toLowerCase() === 'true') return true
  if (value.trim().toLowerCase() === 'false') return false
  return undefined
}

function capabilityToken(value) {
  if (typeof value !== 'string') return undefined
  const token = value.trim().toLowerCase().replaceAll(/[_-]/g, '')
  return Object.entries(CAPABILITY_TOKENS).find(([, tokens]) => tokens.has(token))?.[0]
}

function normalizeCapabilities(row) {
  const result = {}
  const assign = (key, value) => {
    const normalized = booleanValue(value)
    if (normalized !== undefined) result[key] = normalized
  }

  for (const [key, fields] of Object.entries(CAPABILITY_ALIASES)) {
    for (const field of fields) {
      if (row?.[field] !== undefined) assign(key, row[field])
    }
  }

  const sources = [
    row?.capabilities,
    row?.supportedCapabilities,
    row?.supported_capabilities,
    row?.supportedFeatures,
    row?.supported_features,
    row?.features,
  ]
  for (const source of sources) {
    if (Array.isArray(source)) {
      for (const token of source) {
        const key = capabilityToken(token)
        if (key) result[key] = true
      }
    } else if (source && typeof source === 'object') {
      for (const [key, fields] of Object.entries(CAPABILITY_ALIASES)) {
        for (const field of fields) {
          if (source[field] !== undefined) assign(key, source[field])
        }
      }
      for (const [token, value] of Object.entries(source)) {
        const key = capabilityToken(token)
        if (key) assign(key, value)
      }
    }
  }

  const modalitySources = [row?.modalities, row?.inputModalities, row?.input_modalities]
  for (const source of modalitySources) {
    if (!Array.isArray(source)) continue
    for (const token of source) {
      const key = capabilityToken(token)
      if (key) result[key] = true
    }
  }

  const parameterSources = [row?.supportedParameters, row?.supported_parameters]
  for (const source of parameterSources) {
    if (!Array.isArray(source)) continue
    for (const token of source) {
      const key = capabilityToken(token)
      if (key) result[key] = true
    }
  }

  // Model ID & name heuristic markers for modern models
  const idStr = String(row?.id ?? row?.slug ?? row?.model ?? '').toLowerCase()
  if (result.reasoning === undefined && (/(^|[_-])(o1|o3|r1|qwq|deepseek-r1|thinking)($|[_-])/i.test(idStr) || idStr.includes('-r1') || idStr.includes('reasoning') || idStr.includes('thinking'))) {
    result.reasoning = true
  }
  if (result.code === undefined && (/(^|[_-])(coder|code|starcoder|codellama)($|[_-])/i.test(idStr) || idStr.includes('coder') || idStr.includes('code-'))) {
    result.code = true
  }
  if (result.vision === undefined && (/(^|[_-])(vision|vl)($|[_-])/i.test(idStr) || idStr.includes('-vl') || idStr.includes('-vision'))) {
    result.vision = true
  }

  return Object.keys(result).length > 0 ? result : undefined
}


function isGroqMinijinjaModel(id) {
  if (typeof id !== 'string') return false
  const lower = id.toLowerCase().replace(/^groq\//, '')
  return (
    lower.startsWith('qwen') ||
    lower.startsWith('meta-llama') ||
    lower.startsWith('llama') ||
    lower.startsWith('mistral') ||
    lower.startsWith('mixtral') ||
    lower.startsWith('gemma') ||
    lower.startsWith('deepseek')
  )
}

function normalizeCompat(provider, row, id) {
  const source = row?.compat && typeof row.compat === 'object' ? { ...row.compat } : {}
  const isGroq = provider === 'groq'
  const isDeepSeek = provider === 'deepseek'

  let defaultSupportsDeveloperRole
  if (isGroq && id && isGroqMinijinjaModel(id)) {
    defaultSupportsDeveloperRole = false
  } else if (isDeepSeek) {
    defaultSupportsDeveloperRole = false
  }

  if (source.supportsDeveloperRole === undefined && defaultSupportsDeveloperRole !== undefined) {
    source.supportsDeveloperRole = defaultSupportsDeveloperRole
  }

  const refCompat = lookupReferenceCompat(provider, id)
  if (refCompat) {
    for (const [k, v] of Object.entries(refCompat)) {
      if (source[k] === undefined) source[k] = v
    }
  }

  return Object.keys(source).length > 0 ? source : undefined
}

function normalizeInput(row) {
  const modalitySources = [row?.inputModalities, row?.input_modalities, row?.modalities]
  for (const source of modalitySources) {
    if (Array.isArray(source) && source.length > 0) {
      const set = new Set()
      for (const item of source) {
        if (typeof item !== 'string') continue
        const val = item.trim().toLowerCase()
        if (val === 'image' || val === 'vision') set.add('image')
        else if (val === 'text') set.add('text')
        else if (val) set.add(val)
      }
      const order = ['text', 'image']
      const result = []
      for (const k of order) {
        if (set.has(k)) {
          result.push(k)
          set.delete(k)
        }
      }
      for (const k of set) {
        result.push(k)
      }
      if (result.length > 0) return result
    }
  }

  if (Array.isArray(row?.input)) {
    return row.input.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean)
  }

  return undefined
}

function normalizeTags(row) {
  const source = row?.tags ?? row?.labels
  if (!Array.isArray(source)) return undefined
  const tags = [...new Set(source
    .filter((tag) => typeof tag === 'string' && tag.trim())
    .map((tag) => tag.trim())
    .slice(0, 50))]
  return tags.length > 0 ? tags : undefined
}

function normalizeAliases(row, id) {
  const aliases = []
  for (const field of ID_ALIASES) {
    const source = row?.[field]
    const values = Array.isArray(source) ? source : source === undefined || source === null ? [] : [source]
    for (const value of values) {
      if (typeof value !== 'string') continue
      const alias = value.trim()
      if (alias && alias !== id && !aliases.includes(alias)) aliases.push(alias)
    }
  }
  return aliases.slice(0, 20)
}

function normalizeLifecycle(row) {
  const source = row?.lifecycle && typeof row.lifecycle === 'object' ? row.lifecycle : {}
  const deprecated = booleanValue(source.deprecated ?? row?.deprecated ?? row?.isDeprecated)
  const date = source.deprecationDate ?? source.deprecation_date ?? source.expirationDate ?? source.expiration_date ?? source.expiresAt ?? source.expires_at ?? row?.deprecationDate ?? row?.deprecation_date ?? row?.expirationDate ?? row?.expiration_date ?? row?.expiresAt ?? row?.expires_at
  const deprecationDate = typeof date === 'string' && date.trim() ? date.trim() : undefined
  if (deprecated === undefined && deprecationDate === undefined) return undefined
  return {
    ...(deprecated === undefined ? {} : { deprecated }),
    ...(deprecationDate === undefined ? {} : { deprecationDate }),
  }
}

function normalizePricing(row) {
  const source = row?.pricing ?? row?.price ?? row?.cost
  if (!source || typeof source !== 'object') return undefined
  const inputPerToken = firstNumber(source, PRICING_ALIASES.inputPerToken, { allowZero: true })
  const outputPerToken = firstNumber(source, PRICING_ALIASES.outputPerToken, { allowZero: true })
  const cacheReadPerToken = firstNumber(source, PRICING_ALIASES.cacheReadPerToken, { allowZero: true })
  const cacheWritePerToken = firstNumber(source, PRICING_ALIASES.cacheWritePerToken, { allowZero: true })
  if (inputPerToken === undefined && outputPerToken === undefined && cacheReadPerToken === undefined && cacheWritePerToken === undefined) return undefined
  const pricing = {
    ...(inputPerToken === undefined ? {} : { inputPerToken }),
    ...(outputPerToken === undefined ? {} : { outputPerToken }),
    ...(cacheReadPerToken === undefined ? {} : { cacheReadPerToken }),
    ...(cacheWritePerToken === undefined ? {} : { cacheWritePerToken }),
  }
  if (typeof source.currency === 'string' && source.currency.trim()) pricing.currency = source.currency.trim()
  if (typeof source.unit === 'string' && source.unit.trim()) pricing.unit = source.unit.trim()
  if (typeof source.source === 'string' && source.source.trim()) pricing.source = source.source.trim()
  return pricing
}

function normalizeDate(val) {
  if (val === undefined || val === null || val === '') return undefined
  if (typeof val === 'number' && Number.isFinite(val)) {
    const ms = val < 1e11 ? val * 1000 : val
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  if (typeof val === 'string' && val.trim()) {
    const s = val.trim()
    if (/^\d+$/.test(s)) {
      const n = Number(s)
      const ms = n < 1e11 ? n * 1000 : n
      const d = new Date(ms)
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
    }
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  return undefined
}

function normalizeReasoningConfig(provider, row, id, capabilities) {
  const source = row?.reasoningConfig && typeof row.reasoningConfig === 'object' ? { ...row.reasoningConfig } : {}
  const ref = lookupReferenceReasoning(provider, id)
  if (ref) {
    for (const [k, v] of Object.entries(ref)) {
      if (source[k] === undefined) source[k] = v
    }
  }
  const isReasoning = capabilities?.reasoning === true ||
    Boolean(source.supportsReasoning) ||
    /(^|[_-])(o1|o3|r1|qwq|thinking)($|[_-])/i.test(id) ||
    id.toLowerCase().includes('reasoner') ||
    id.toLowerCase().includes('-r1') ||
    id.toLowerCase().includes('thinking')

  if (!isReasoning && Object.keys(source).length === 0) {
    return undefined
  }

  source.supportsReasoning = true
  if (!source.paramFormat) {
    const idLower = id.toLowerCase()
    const provLower = String(provider || '').toLowerCase()
    if (provLower === 'openai' || /(^|[_-])(o1|o3)($|[_-])/i.test(idLower)) {
      source.paramFormat = 'effort'
      source.defaultEffort = source.defaultEffort || 'medium'
      source.supportedEfforts = source.supportedEfforts || ['low', 'medium', 'high']
    } else if (provLower === 'anthropic' || idLower.includes('claude-3-7') || idLower.includes('claude-3.7')) {
      source.paramFormat = 'budget_tokens'
      source.defaultBudget = source.defaultBudget || 4096
      source.maxBudget = source.maxBudget || 64000
    } else if (provLower === 'deepseek' && (idLower.includes('reasoner') || idLower.includes('r1'))) {
      source.paramFormat = 'boolean'
    } else if (idLower.includes('thinking') || idLower.includes('r1') || idLower.includes('qwq')) {
      source.paramFormat = 'budget_tokens'
      source.defaultBudget = source.defaultBudget || 4096
      source.maxBudget = source.maxBudget || 32768
    } else {
      source.paramFormat = 'boolean'
    }
  }
  return source
}


export {
  FIELD_ALIASES,
  firstNumber,
  normalizeCapabilities,
  normalizeCompat,
  normalizeInput,
  normalizeTags,
  normalizeAliases,
  normalizeLifecycle,
  normalizePricing,
  normalizeDate,
  normalizeReasoningConfig,
}
