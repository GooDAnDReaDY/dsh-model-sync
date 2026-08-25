const CAPABILITY_KEYS = new Set(['vision', 'tools', 'reasoning', 'embeddings'])
const MAX_PATTERNS = 100
const MAX_PATTERN_LENGTH = 256

function list(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, MAX_PATTERNS))]
}

function capabilities(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter(([key, val]) => CAPABILITY_KEYS.has(key) && typeof val === 'boolean')
    .slice(0, CAPABILITY_KEYS.size))
}

export function normalizePolicy(policy) {
  const value = policy && typeof policy === 'object' && !Array.isArray(policy) ? policy : {}
  return {
    include: list(value.include),
    exclude: list(value.exclude),
    requireCapabilities: capabilities(value.requireCapabilities),
    denyCapabilities: capabilities(value.denyCapabilities),
  }
}

function compilePatterns(patterns, field) {
  return patterns.map((pattern) => {
    if (pattern.length > MAX_PATTERN_LENGTH) throw Object.assign(new Error(`${field} pattern is too long`), { code: 'INVALID_POLICY' })
    try {
      return new RegExp(pattern, 'i')
    } catch {
      throw Object.assign(new Error(`invalid ${field} pattern: ${pattern}`), { code: 'INVALID_POLICY' })
    }
  })
}

export function validatePolicy(policy) {
  const normalized = normalizePolicy(policy)
  compilePatterns(normalized.include, 'include')
  compilePatterns(normalized.exclude, 'exclude')
  return normalized
}

export function hasPolicy(policy) {
  const normalized = normalizePolicy(policy)
  return normalized.include.length > 0
    || normalized.exclude.length > 0
    || Object.keys(normalized.requireCapabilities).length > 0
    || Object.keys(normalized.denyCapabilities).length > 0
}

export function filterModels(models, policy) {
  const normalized = validatePolicy(policy)
  const include = compilePatterns(normalized.include, 'include')
  const exclude = compilePatterns(normalized.exclude, 'exclude')
  return (models ?? []).filter((model) => {
    const haystack = [model?.id, model?.name, ...(Array.isArray(model?.tags) ? model.tags : [])]
      .filter((value) => typeof value === 'string').join('\n')
    if (include.length > 0 && !include.some((pattern) => pattern.test(haystack))) return false
    if (exclude.some((pattern) => pattern.test(haystack))) return false
    const modelCapabilities = model?.capabilities ?? {}
    for (const [key, expected] of Object.entries(normalized.requireCapabilities)) {
      if (modelCapabilities[key] !== expected) return false
    }
    for (const [key, denied] of Object.entries(normalized.denyCapabilities)) {
      if (modelCapabilities[key] === denied) return false
    }
    return true
  })
}
