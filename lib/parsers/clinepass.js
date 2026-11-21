import { normalizeModels } from '../models.js'
/**
 * DeepSeek Harness Model Sync — ClinePass / ClineBot Protocol Parser (#151, #277)
 */

import { lookupReferenceLimits, lookupReferenceSpec } from '../specs-database.js'
import { lookupReferencePricing } from '../pricing-database.js'

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
  if (!includedInput) return []
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
    return []
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

  if (!parts.length) return []

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
  return normalizeModels('clinebot', matched)
}
