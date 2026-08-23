import { canUseGenericAdapter, createGenericAdapter } from './generic-adapter.js'
import { normalizeModels } from './models.js'

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

const PROVIDER_ADAPTERS = Object.freeze({
  anthropic: { endpoint: 'https://api.anthropic.com/v1/models', auth: 'x-api-key', headers: { 'anthropic-version': '2023-06-01' } },
  google: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/models', auth: 'query-key', parse: 'google' },
  openai: { endpoint: 'https://api.openai.com/v1/models', auth: 'bearer' },
  deepseek: { endpoint: 'https://api.deepseek.com/models', auth: 'bearer' },
  xai: { endpoint: 'https://api.x.ai/v1/models', auth: 'bearer' },
  openrouter: { endpoint: 'https://openrouter.ai/api/v1/models', auth: 'bearer' },
  groq: { endpoint: 'https://api.groq.com/openai/v1/models', auth: 'bearer' },
  mistral: { endpoint: 'https://api.mistral.ai/v1/models', auth: 'bearer' },
  'ant-ling': { endpoint: 'https://api.ant-ling.com/v1/models', auth: 'bearer' },
  cerebras: { endpoint: 'https://api.cerebras.ai/v1/models', auth: 'bearer' },
  fireworks: { endpoint: 'https://api.fireworks.ai/inference/v1/models', auth: 'bearer' },
  huggingface: { endpoint: 'https://router.huggingface.co/v1/models', auth: 'bearer' },
  'moonshotai': { endpoint: 'https://api.moonshot.ai/v1/models', auth: 'bearer' },
  'moonshotai-cn': { endpoint: 'https://api.moonshot.cn/v1/models', auth: 'bearer' },
  nvidia: { endpoint: 'https://integrate.api.nvidia.com/v1/models', auth: 'bearer' },
  'qwen-token-plan': { endpoint: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models', auth: 'bearer' },
  'qwen-token-plan-cn': { endpoint: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/models', auth: 'bearer' },
  together: { endpoint: 'https://api.together.ai/v1/models', auth: 'bearer' },
  'xiaomi': { endpoint: 'https://api.xiaomimimo.com/v1/models', auth: 'bearer' },
  'xiaomi-token-plan-ams': { endpoint: 'https://token-plan-ams.xiaomimimo.com/v1/models', auth: 'bearer' },
  'xiaomi-token-plan-cn': { endpoint: 'https://token-plan-cn.xiaomimimo.com/v1/models', auth: 'bearer' },
  'xiaomi-token-plan-sgp': { endpoint: 'https://token-plan-sgp.xiaomimimo.com/v1/models', auth: 'bearer' },
  zai: { endpoint: 'https://api.z.ai/api/coding/paas/v4/models', auth: 'bearer' },
  'zai-coding-cn': { endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/models', auth: 'bearer' },
})

function parseRows(provider, payload, parser) {
  if (parser === 'google') {
    const rows = Array.isArray(payload?.models) ? payload.models : []
    return normalizeModels(provider, rows.map((row) => ({
      ...row,
      id: String(row.name ?? '').replace(/^models\//, ''),
      name: row.displayName ?? row.display_name ?? row.name,
      contextWindow: row.inputTokenLimit,
      maxTokens: row.outputTokenLimit,
    })))
  }
  const rows = payload?.data ?? payload?.models ?? payload?.availableModels
  return normalizeModels(provider, Array.isArray(rows) ? rows : [])
}

async function fetchSpecific(profile, descriptor, { resolveCredential, fetchImpl, signal }) {
  const apiKey = profile.apiKeyEnv ? await resolveCredential(profile.apiKeyEnv) : ''
  const url = new URL(profile.baseURL ? `${String(profile.baseURL).replace(/\/+$/, '')}/models` : descriptor.endpoint)
  const headers = { Accept: 'application/json', ...(descriptor.headers ?? {}) }
  if (descriptor.auth === 'bearer' && apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (descriptor.auth === 'x-api-key' && apiKey) headers['x-api-key'] = apiKey
  if (descriptor.auth === 'query-key' && apiKey) url.searchParams.set('key', apiKey)
  const response = await fetchImpl(url, { headers, signal })
  if (!response.ok) throw new Error(`model catalog request failed with HTTP ${response.status}`)
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('model catalog response is too large')
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('model catalog response is not valid JSON')
  }
  return parseRows(profile.provider, payload, descriptor.parse)
}

export function createProviderAdapterRegistry({ resolveCredential, fetchImpl = fetch } = {}) {
  const generic = createGenericAdapter({ resolveCredential, fetchImpl })
  return Object.freeze({
    descriptors: PROVIDER_ADAPTERS,
    select(profile) {
      if (canUseGenericAdapter(profile)) return generic
      const descriptor = PROVIDER_ADAPTERS[profile?.provider]
      if (!descriptor) return null
      return Object.freeze({
        id: `provider:${profile.provider}`,
        canHandle: () => true,
        discover: (current, options = {}) => fetchSpecific(current, descriptor, {
          resolveCredential,
          fetchImpl,
          ...options,
        }),
      })
    },
  })
}
