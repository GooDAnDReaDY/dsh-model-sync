import { lookupReferencePricing } from './pricing-database.js'
import { lookupReferenceLimits, lookupReferenceReasoning, lookupReferenceCompat } from './specs-database.js'
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

export function deriveModelTags(model) {
  if (!model || typeof model !== "object") return []
  const tags = new Set(Array.isArray(model.tags) ? model.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim().toLowerCase()) : [])
  const idLower = String(model.id || "").toLowerCase()
  const nameLower = String(model.name || "").toLowerCase()
  const provLower = String(model.provider || "").toLowerCase()
  const capabilities = model.capabilities || {}

  // 1. coding
  if (
    capabilities.code === true ||
    idLower.includes("coder") ||
    idLower.includes("codestral") ||
    idLower.includes("starcoder") ||
    idLower.includes("deepseek-coder") ||
    idLower.includes("claude-3-7-sonnet") ||
    idLower.includes("claude-3-5-sonnet") ||
    idLower.includes("kimi-k2.7-code") ||
    idLower.includes("qwen-2.5-coder") ||
    idLower.includes("qwen2.5-coder") ||
    (/(^|[_-])(code|dev|prog)($|[_-])/i.test(idLower)) ||
    (/(^|[_-])(code|coder)($|[_-])/i.test(nameLower))
  ) {
    tags.add("coding")
  }

  // 2. reasoning
  if (
    model.reasoningConfig?.supportsReasoning === true ||
    capabilities.reasoning === true ||
    /(^|[_-])(o1|o3|r1|qwq)($|[_-])/i.test(idLower) ||
    idLower.includes("reasoner") ||
    idLower.includes("deepseek-r1") ||
    idLower.includes("thinking") ||
    idLower.includes("-r1")
  ) {
    tags.add("reasoning")
  }

  // 3. fast
  if (
    provLower === "groq" ||
    provLower === "cerebras" ||
    idLower.includes("flash") ||
    idLower.includes("mini") ||
    idLower.includes("instant") ||
    idLower.includes("haiku") ||
    idLower.includes("small") ||
    idLower.includes("8b") ||
    idLower.includes("3b") ||
    idLower.includes("1b") ||
    idLower.includes("turbo") ||
    idLower.includes("lite") ||
    idLower.includes("nano")
  ) {
    tags.add("fast")
  }

  // 4. vision
  if (
    capabilities.vision === true ||
    (Array.isArray(model.input) && model.input.includes("image")) ||
    idLower.includes("vision") ||
    idLower.includes("vl") ||
    idLower.includes("pixtral") ||
    idLower.includes("gemini") ||
    idLower.includes("claude-3") ||
    idLower.includes("4o")
  ) {
    tags.add("vision")
  }

  // 5. long-context (>= 128k tokens)
  if (typeof model.contextWindow === "number" && model.contextWindow >= 128000) {
    tags.add("long-context")
  }

  return [...tags].sort()
}

export function isCuratedModel(model) {
  if (!model || typeof model !== "object") return false
  if (model.lifecycle?.deprecated) return false
  const id = String(model.id || "").toLowerCase()
  if (/-(202\d{5}|202\d-\d{2}-\d{2}|\d{4})$/.test(id) && !id.includes("claude-3-7") && !id.includes("claude-3-5")) {
    return false
  }
  if (id.includes("-0314") || id.includes("-0613") || id.includes("-1106") || id.includes("-0125")) {
    return false
  }

  const curatedIds = [
    "claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku",
    "gpt-4o", "gpt-4o-mini", "o1", "o3-mini",
    "deepseek-chat", "deepseek-reasoner", "deepseek-v3", "deepseek-r1",
    "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
    "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama-3.1-70b-versatile",
    "qwen-2.5-coder-32b", "qwen-2.5-72b", "qwq-32b",
    "mistral-large", "codestral", "pixtral-large",
    "kimi-k2.7-code"
  ]

  for (const c of curatedIds) {
    if (id === c || id.endsWith("/" + c) || id.includes(c)) return true
  }

  const tags = model.tags || deriveModelTags(model)
  if (tags.includes("coding") && tags.includes("reasoning") && tags.includes("long-context")) {
    return true
  }

  return false
}

export function normalizeModel(provider, row) {
  if (typeof row === 'string') {
    row = { id: row }
  }
  if (!row || typeof row !== 'object') return null
  const effectiveProvider = (typeof provider === 'string' && provider.trim())
    ? provider.trim()
    : (typeof row.provider === 'string' ? row.provider.trim() : '')
  const id = String(row.id ?? row.slug ?? row.model ?? (typeof row.name === 'string' && row.name.startsWith('models/') ? row.name.replace(/^models\//, '') : '')).trim()
  if (!id) return null
  const name = String(row.name ?? row.displayName ?? row.display_name ?? id).trim() || id
  const rawContextWindow = firstNumber(row, FIELD_ALIASES.contextWindow)
  const rawMaxOutputTokens = firstNumber(row, FIELD_ALIASES.maxOutputTokens)
  const refLimits = lookupReferenceLimits(effectiveProvider || provider, id)
  const contextWindow = rawContextWindow ?? refLimits?.contextWindow
  const maxOutputTokens = rawMaxOutputTokens ?? refLimits?.maxOutputTokens
  const maxTokens = maxOutputTokens ?? firstNumber(row, FIELD_ALIASES.maxTokens)
  const capabilities = normalizeCapabilities(row)
  const pricing = normalizePricing(row) ?? lookupReferencePricing(effectiveProvider || provider, id)
  const tags = normalizeTags(row)
  const aliases = normalizeAliases(row, id)
  const lifecycle = normalizeLifecycle(row)
  const input = normalizeInput(row)
  const compat = normalizeCompat(effectiveProvider, row, id)
  const reasoningConfig = normalizeReasoningConfig(effectiveProvider || provider, row, id, capabilities)
  const firstSeenAt = normalizeDate(row.firstSeenAt)
  const createdAt = normalizeDate(row.createdAt ?? row.created)
  return {
    provider: effectiveProvider || provider,
    id,
    name,
    ...(firstSeenAt === undefined ? {} : { firstSeenAt }),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(row.description ? { description: String(row.description) } : {}),
    ...(input === undefined ? {} : { input }),
    ...(compat === undefined ? {} : { compat }),
    ...(capabilities === undefined ? {} : { capabilities }),
    ...(reasoningConfig === undefined ? {} : { reasoningConfig }),
    ...(pricing === undefined ? {} : { pricing }),
    ...(tags === undefined ? {} : { tags }),
    ...(aliases.length === 0 ? {} : { aliases }),
    ...(lifecycle === undefined ? {} : { lifecycle }),
  }
}

export function normalizeModels(provider, rows) {
  const out = []
  const seen = new Set()
  for (const row of rows ?? []) {
    const model = normalizeModel(provider, row)
    if (!model || seen.has(model.id)) continue
    seen.add(model.id)
    out.push(model)
  }
  return out
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function diffModels(previous, next) {
  const sortModels = (rows) => normalizeModels('', rows).sort((left, right) => left.id.localeCompare(right.id))
  const beforeRows = sortModels(previous)
  const afterRows = sortModels(next)
  const before = new Map(beforeRows.map((row) => [row.id, row]))
  const after = new Map(afterRows.map((row) => [row.id, row]))
  const added = []
  const removed = []
  const renamed = []
  const changed = []
  const renamedBefore = new Set()
  for (const [id, model] of after) {
    if (!before.has(id)) continue
    if (stableStringify(before.get(id)) !== stableStringify(model)) {
      changed.push({ before: before.get(id), after: model })
    }
  }
  for (const [id, model] of after) {
    if (before.has(id)) continue
    const match = beforeRows.find((candidate) => {
      if (renamedBefore.has(candidate.id)) return false
      return model.aliases?.includes(candidate.id) || candidate.aliases?.includes(model.id)
    })
    if (match) {
      renamed.push({ before: match, after: model })
      renamedBefore.add(match.id)
    } else {
      added.push(model)
    }
  }
  for (const [id, model] of before) {
    if (!after.has(id) && !renamedBefore.has(id)) removed.push(model)
  }
  added.sort((left, right) => left.id.localeCompare(right.id))
  removed.sort((left, right) => left.id.localeCompare(right.id))
  renamed.sort((left, right) => left.before.id.localeCompare(right.before.id))
  changed.sort((left, right) => left.before.id.localeCompare(right.before.id))
  return {
    added,
    removed,
    renamed,
    changed,
    hasChanges: added.length > 0 || removed.length > 0 || renamed.length > 0 || changed.length > 0,
  }
}

export const CLINEPASS_MODELS = Object.freeze([
  {
    id: 'cline-pass/deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { vision: true, code: true, reasoning: true },
    input: ['text', 'image'],
  },
  {
    id: 'cline-pass/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { vision: true, code: true, reasoning: true },
    input: ['text', 'image'],
  },
  {
    id: 'cline-pass/glm-5.2',
    name: 'GLM 5.2',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { code: true },
    input: ['text'],
  },
  {
    id: 'cline-pass/kimi-k3',
    name: 'Kimi K3',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { reasoning: true },
    input: ['text'],
  },
  {
    id: 'cline-pass/kimi-k2.7-code',
    name: 'Kimi K2.7 Code',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { code: true, tools: true },
    input: ['text'],
  },
  {
    id: 'cline-pass/kimi-k2.6',
    name: 'Kimi K2.6',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { code: true },
    input: ['text'],
  },
  {
    id: 'cline-pass/qwen3.7-max',
    name: 'Qwen 3.7 Max',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { vision: true },
    input: ['text', 'image'],
  },
  {
    id: 'cline-pass/qwen3.7-plus',
    name: 'Qwen 3.7 Plus',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { vision: true },
    input: ['text', 'image'],
  },
  {
    id: 'cline-pass/minimax-m3',
    name: 'MiniMax M3',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { reasoning: true },
    input: ['text'],
  },
  {
    id: 'cline-pass/mimo-v2.5',
    name: 'MiMo V2.5',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { code: true },
    input: ['text'],
  },
  {
    id: 'cline-pass/mimo-v2.5-pro',
    name: 'MiMo V2.5 Pro',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    maxTokens: 8192,
    capabilities: { code: true, reasoning: true },
    input: ['text'],
  },
])

export function parseClinePassModels(includedInput) {
  if (!includedInput) return [...CLINEPASS_MODELS]
  let includedText = ''
  if (Array.isArray(includedInput)) {
    const foundStr = includedInput.find((item) => typeof item === 'string' && /includes\s+/i.test(item))
    if (foundStr) {
      includedText = foundStr
    } else {
      includedText = includedInput.filter((x) => typeof x === 'string').join(', ')
    }
  } else if (typeof includedInput === 'string') {
    includedText = includedInput
  } else {
    return [...CLINEPASS_MODELS]
  }

  const clean = includedText
    .replace(/^includes\s+/i, '')
    .replace(/\band\b/gi, ',')
    .replace(/\./g, '')
    .trim()

  const parts = clean
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (!parts.length) return [...CLINEPASS_MODELS]

  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[\s._-]+/g, '')

  const matched = []
  for (const name of parts) {
    const targetNorm = normalize(name)
    const found = CLINEPASS_MODELS.find(
      (m) =>
        normalize(m.name) === targetNorm ||
        normalize(m.id.replace(/^cline-pass\//, '')) === targetNorm
    )
    if (found) {
      matched.push(found)
    } else {
      const idPart = name.toLowerCase().replace(/[\s_]+/g, '-')
      matched.push({
        id: `cline-pass/${idPart}`,
        name,
        contextWindow: 200000,
        maxOutputTokens: 8192,
    maxTokens: 8192,
        capabilities: {},
        input: ['text'],
      })
    }
  }
  return normalizeModels('clinebot', matched.length ? matched : [...CLINEPASS_MODELS])
}
