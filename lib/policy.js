const CAPABILITY_KEYS = new Set(['vision', 'tools', 'reasoning', 'embeddings', 'code'])
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
  const res = {
    include: list(value.include),
    exclude: list(value.exclude),
    requireCapabilities: capabilities(value.requireCapabilities),
    denyCapabilities: capabilities(value.denyCapabilities),
  }
  if (value.enableCostFilter) res.enableCostFilter = true
  if (typeof value.maxPricePerMillion === 'number' && Number.isFinite(value.maxPricePerMillion) && value.maxPricePerMillion >= 0) {
    res.maxPricePerMillion = value.maxPricePerMillion
  }
  if (value.enableContextFilter) res.enableContextFilter = true
  if (typeof value.minContextTokens === 'number' && Number.isFinite(value.minContextTokens) && value.minContextTokens >= 0) {
    res.minContextTokens = Math.floor(value.minContextTokens)
  }
  return res
}

function isDangerousPattern(pattern) {
  if (typeof pattern !== 'string') return false
  // Check for nested quantifiers like (a+)+, (a*)*, (a+)*, (a{1,2})+
  if (/(\([^)]*[+*]\)[+*?{])|(\([^)]*\{[0-9]+,[0-9]*\}\)[+*?{])/.test(pattern)) return true
  // Check for quantified groups containing quantified inner constructs
  if (/\([^\)]*([+*]|\{[0-9]+,[0-9]*\})[^\)]*\)([+*]|\{[0-9]+,[0-9]*\})/.test(pattern)) return true
  // Check for multiple consecutive open-ended wildcards (e.g. .*.*)
  if (/(\.\*|\.\+){2,}/.test(pattern)) return true
  // Check for quantified alternation groups like (a|aa)+, (a|b)+, (a|b)*, (a|aa){2,}
  let simplified = pattern
  while (/\(\(([^()]+)\)\)/.test(simplified)) {
    simplified = simplified.replace(/\(\(([^()]+)\)\)/g, '($1)')
  }
  if (/\((?:[^()]*\|)+[^()]*\)\s*([+*]|\{[0-9]+,[0-9]*\})/.test(simplified)) return true
  return false
}

function compilePatterns(patterns, field) {
  return patterns.map((pattern) => {
    if (pattern.length > MAX_PATTERN_LENGTH) throw Object.assign(new Error(`${field} pattern is too long`), { code: 'INVALID_POLICY' })
    if (isDangerousPattern(pattern)) throw Object.assign(new Error(`${field} pattern has catastrophic backtracking risk: ${pattern}`), { code: 'INVALID_POLICY' })
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
  const hasRequire = Object.values(normalized.requireCapabilities).some((v) => v === true)
  const hasDeny = Object.values(normalized.denyCapabilities).some((v) => v === true)
  return normalized.include.length > 0
    || normalized.exclude.length > 0
    || hasRequire
    || hasDeny
    || (normalized.enableCostFilter && normalized.maxPricePerMillion !== undefined)
    || (normalized.enableContextFilter && normalized.minContextTokens !== undefined)
}

export function filterModels(models, policy) {
  if (!models || !models.length) return []
  if (!hasPolicy(policy)) return models
  const normalized = validatePolicy(policy)
  const include = compilePatterns(normalized.include, 'include')
  const exclude = compilePatterns(normalized.exclude, 'exclude')
  return models.filter((model) => {
    const haystack = [model?.id, model?.name, ...(Array.isArray(model?.tags) ? model.tags : [])]
      .filter((value) => typeof value === 'string').join('\n')
    if (include.length > 0 && !include.some((pattern) => pattern.test(haystack))) return false
    if (exclude.some((pattern) => pattern.test(haystack))) return false
    const modelCapabilities = model?.capabilities ?? {}
    for (const [key, expected] of Object.entries(normalized.requireCapabilities)) {
      if (expected === true && modelCapabilities[key] !== true) return false
    }
    for (const [key, denied] of Object.entries(normalized.denyCapabilities)) {
      if (denied === true && modelCapabilities[key] === true) return false
    }
    if (normalized.enableCostFilter && normalized.maxPricePerMillion !== undefined) {
      const inputPrice = model?.pricing?.inputPerToken
      if (typeof inputPrice === 'number' && Number.isFinite(inputPrice)) {
        if (inputPrice * 1000000 > normalized.maxPricePerMillion) return false
      }
    }
    if (normalized.enableContextFilter && normalized.minContextTokens !== undefined) {
      const context = model?.contextWindow
      if (typeof context === 'number' && Number.isFinite(context)) {
        if (context < normalized.minContextTokens) return false
      }
    }
    return true
  })
}
