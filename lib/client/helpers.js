// Pure UI formatting, curation, tag derivation, and capability filtering helpers (#279)

export const SPARKLINE_BARS = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█']

export function generateSparkline(values) {
  if (!Array.isArray(values) || values.length === 0) return ''
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) return ''
  if (nums.length === 1) return '▄'
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (min === max) return '▄'.repeat(nums.length)
  const range = max - min
  return nums.map((v) => SPARKLINE_BARS[Math.min(7, Math.max(0, Math.floor(((v - min) / range) * 7)))]).join('')
}

export function classifySpeedTier(latencyMs, isOk = true) {
  if (!isOk) return 'degraded'
  if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs <= 0) return 'unknown'
  if (latencyMs < 300) return 'lightning'
  if (latencyMs < 1200) return 'fast'
  if (latencyMs <= 3000) return 'moderate'
  return 'slow'
}

export function deriveModelTags(model) {
  if (!model || typeof model !== 'object') return []
  const tags = new Set(Array.isArray(model.tags) ? model.tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().toLowerCase()) : [])
  const idLower = String(model.id || '').toLowerCase()
  const nameLower = String(model.name || '').toLowerCase()
  const provLower = String(model.provider || '').toLowerCase()
  const capabilities = model.capabilities || {}

  if (capabilities.code === true || idLower.includes('coder') || idLower.includes('codestral') || idLower.includes('starcoder') || idLower.includes('deepseek-coder') || idLower.includes('claude-3-7-sonnet') || idLower.includes('claude-3-5-sonnet') || idLower.includes('kimi-k2.7-code') || idLower.includes('qwen-2.5-coder') || idLower.includes('qwen2.5-coder') || (/(^|[_-])(code|dev|prog)($|[_-])/i.test(idLower)) || (/(^|[_-])(code|coder)($|[_-])/i.test(nameLower))) {
    tags.add('coding')
  }
  if (model.reasoningConfig?.supportsReasoning === true || capabilities.reasoning === true || /(^|[_-])(o1|o3|r1|qwq)($|[_-])/i.test(idLower) || idLower.includes('reasoner') || idLower.includes('deepseek-r1') || idLower.includes('thinking') || idLower.includes('-r1')) {
    tags.add('reasoning')
  }
  if (provLower === 'groq' || provLower === 'cerebras' || idLower.includes('flash') || idLower.includes('mini') || idLower.includes('instant') || idLower.includes('haiku') || idLower.includes('small') || idLower.includes('8b') || idLower.includes('3b') || idLower.includes('1b') || idLower.includes('turbo') || idLower.includes('lite') || idLower.includes('nano')) {
    tags.add('fast')
  }
  if (capabilities.vision === true || (Array.isArray(model.input) && model.input.includes('image')) || idLower.includes('vision') || idLower.includes('vl') || idLower.includes('pixtral') || idLower.includes('gemini') || idLower.includes('claude-3') || idLower.includes('4o')) {
    tags.add('vision')
  }
  if (typeof model.contextWindow === 'number' && model.contextWindow >= 128000) {
    tags.add('long-context')
  }
  return [...tags].sort()
}

export function isCuratedModel(model) {
  if (!model || typeof model !== 'object') return false
  if (model.lifecycle?.deprecated) return false
  const id = String(model.id || '').toLowerCase()
  if (/-(202\d{5}|202\d-\d{2}-\d{2}|\d{4})$/.test(id) && !id.includes('claude-3-7') && !id.includes('claude-3-5')) {
    return false
  }
  if (id.includes('-0314') || id.includes('-0613') || id.includes('-1106') || id.includes('-0125')) {
    return false
  }
  const curatedIds = [
    'claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku',
    'gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini',
    'deepseek-chat', 'deepseek-reasoner', 'deepseek-v3', 'deepseek-r1',
    'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash',
    'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile',
    'qwen-2.5-coder-32b', 'qwen-2.5-72b', 'qwq-32b',
    'mistral-large', 'codestral', 'pixtral-large',
    'kimi-k2.7-code'
  ]
  for (const c of curatedIds) {
    if (id === c || id.endsWith('/' + c) || id.includes(c)) return true
  }
  const tags = model.tags || deriveModelTags(model)
  return tags.includes('coding') && tags.includes('reasoning') && tags.includes('long-context')
}

export function formatTokens(num) {
  if (typeof num !== "number" || !Number.isFinite(num) || num <= 0) return "?";
  if (num >= 1000000) {
    const m = num / 1000000;
    return (m % 1 === 0 ? m : m.toFixed(1)) + "M";
  }
  if (num >= 1000) {
    const k = num / 1000;
    return (k % 1 === 0 ? k : k.toFixed(0)) + "k";
  }
  return String(num);
}

export function filterModelsByCapabilities(models, selected) {
  const required = [...new Set((selected ?? []).filter((key) => typeof key === 'string' && key))]
  return (models ?? []).filter((model) => required.every((key) => model?.capabilities?.[key] === true))
}
