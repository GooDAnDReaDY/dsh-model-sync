const FIELD_ALIASES = Object.freeze({
  contextWindow: [
    'contextWindow', 'context_window', 'contextLength', 'context_length',
    'maxContextTokens', 'max_context_tokens', 'maxContextLength', 'max_context_length',
    'inputTokenLimit', 'input_token_limit',
  ],
  maxTokens: [
    'maxTokens', 'max_tokens', 'max_output_tokens', 'maxOutputTokens',
    'outputTokenLimit', 'output_token_limit',
  ],
})

const CAPABILITY_ALIASES = Object.freeze({
  vision: ['vision', 'supportsVision', 'supports_vision', 'imageInput', 'image_input'],
  tools: ['tools', 'toolUse', 'tool_use', 'functionCalling', 'function_calling', 'supportsTools', 'supports_tools'],
  reasoning: ['reasoning', 'supportsReasoning', 'supports_reasoning', 'thinking', 'extendedThinking', 'extended_thinking'],
  embeddings: ['embeddings', 'embedding', 'supportsEmbeddings', 'supports_embeddings'],
})

const CAPABILITY_TOKENS = Object.freeze({
  vision: new Set(['vision', 'image', 'imageinput', 'multimodal']),
  tools: new Set(['tools', 'tooluse', 'toolchoice', 'functioncalling', 'functioncall']),
  reasoning: new Set(['reasoning', 'reasoningeffort', 'thinking', 'extendedthinking']),
  embeddings: new Set(['embedding', 'embeddings']),
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
  const number = Number(value)
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) return undefined
  return number
}

function firstNumber(row, fields, options) {
  for (const field of fields) {
    const value = numericValue(row?.[field], options)
    if (value !== undefined) return value
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

  const sources = [row?.capabilities, row?.supportedCapabilities, row?.supported_capabilities]
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
  return Object.keys(result).length > 0 ? result : undefined
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
  return pricing
}

export function normalizeModel(provider, row) {
  if (typeof row === 'string') {
    row = { id: row }
  }
  if (!row || typeof row !== 'object') return null
  const id = String(row.id ?? row.slug ?? row.model ?? '').trim()
  if (!id) return null
  const name = String(row.name ?? row.displayName ?? row.display_name ?? id).trim() || id
  const contextWindow = firstNumber(row, FIELD_ALIASES.contextWindow)
  const maxTokens = firstNumber(row, FIELD_ALIASES.maxTokens)
  const capabilities = normalizeCapabilities(row)
  const pricing = normalizePricing(row)
  const tags = normalizeTags(row)
  const aliases = normalizeAliases(row, id)
  const lifecycle = normalizeLifecycle(row)
  return {
    provider,
    id,
    name,
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(row.description ? { description: String(row.description) } : {}),
    ...(capabilities === undefined ? {} : { capabilities }),
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
    if (JSON.stringify(before.get(id)) !== JSON.stringify(model)) {
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
