import { catalogRequestError } from './reliability.js'
import { canUseGenericAdapter, createGenericAdapter } from './generic-adapter.js'
import { normalizeModels } from './models.js'

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const SAFE_AUTH = new Set(['bearer', 'x-api-key', 'query-key', 'none'])
const SAFE_PARSERS = new Set(['openai', 'google'])
const CAPABILITIES = new Set(['vision', 'tools', 'reasoning', 'embeddings'])
const BLOCKED_HEADERS = /authorization|api[_-]?key|token|secret|cookie/i

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
  moonshotai: { endpoint: 'https://api.moonshot.ai/v1/models', auth: 'bearer' },
  'moonshotai-cn': { endpoint: 'https://api.moonshot.cn/v1/models', auth: 'bearer' },
  nvidia: { endpoint: 'https://integrate.api.nvidia.com/v1/models', auth: 'bearer' },
  'qwen-token-plan': { endpoint: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models', auth: 'bearer' },
  'qwen-token-plan-cn': { endpoint: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/models', auth: 'bearer' },
  together: { endpoint: 'https://api.together.ai/v1/models', auth: 'bearer' },
  xiaomi: { endpoint: 'https://api.xiaomimimo.com/v1/models', auth: 'bearer' },
  'xiaomi-token-plan-ams': { endpoint: 'https://token-plan-ams.xiaomimimo.com/v1/models', auth: 'bearer' },
  'xiaomi-token-plan-cn': { endpoint: 'https://token-plan-cn.xiaomimimo.com/v1/models', auth: 'bearer' },
  'xiaomi-token-plan-sgp': { endpoint: 'https://token-plan-sgp.xiaomimimo.com/v1/models', auth: 'bearer' },
  zai: { endpoint: 'https://api.z.ai/api/coding/paas/v4/models', auth: 'bearer' },
  'zai-coding-cn': { endpoint: 'https://open.bigmodel.cn/api/coding/paas/v4/models', auth: 'bearer' },
  'kimi-coding': { endpoint: 'https://api.kimi.com/coding/v1/models', auth: 'bearer', defaultModels: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2.7-code', 'kimi-k3'] },
  minimax: { endpoint: 'https://api.minimax.io/v1/models', auth: 'bearer' },
})

function pathValue(value, path) {
  if (typeof path !== 'string' || !path.trim()) return undefined
  return path.split('.').reduce((current, key) => current && typeof current === 'object' ? current[key] : undefined, value)
}

function mappedRows(provider, rows, descriptor) {
  const fields = descriptor.fields && typeof descriptor.fields === 'object' ? descriptor.fields : {}
  const capabilityMap = descriptor.capabilityMap && typeof descriptor.capabilityMap === 'object' ? descriptor.capabilityMap : {}
  return rows.map((row) => {
    const mapped = { ...(row && typeof row === 'object' ? row : {}) }
    for (const [target, source] of Object.entries(fields)) {
      if (!['id', 'name', 'description', 'contextWindow', 'maxTokens', 'pricing', 'tags'].includes(target)) continue
      const value = pathValue(row, source)
      if (value !== undefined) mapped[target] = value
    }
    for (const capability of CAPABILITIES) {
      const sources = Array.isArray(capabilityMap[capability]) ? capabilityMap[capability] : [capabilityMap[capability]]
      const source = sources.find((item) => typeof item === 'string' && pathValue(row, item) !== undefined)
      if (source) mapped[capability] = pathValue(row, source)
    }
    return mapped
  })
}

function parseRows(provider, payload, descriptor) {
  if (descriptor.parse === 'google') {
    const rows = Array.isArray(payload?.models) ? payload.models : []
    return normalizeModels(provider, rows.map((row) => ({
      ...row,
      id: String(row.name ?? '').replace(/^models\//, ''),
      name: row.displayName ?? row.display_name ?? row.name,
      contextWindow: row.inputTokenLimit,
      maxTokens: row.outputTokenLimit,
    })))
  }
  const rows = pathValue(payload, descriptor.modelsPath) ?? payload?.data ?? payload?.models ?? payload?.availableModels
  return normalizeModels(provider, Array.isArray(rows) ? mappedRows(provider, rows, descriptor) : [])
}

function privateHttpHost(hostname) {
  const host = String(hostname ?? '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

export function normalizeAdapterConfig(config, profile = {}) {
  const source = config && typeof config === 'object' ? config : {}
  const base = profile.baseURL ? String(profile.baseURL).replace(/\/+$/, '') : ''
  const endpointValue = source.endpoint || (base ? (base.endsWith('/models') ? base : base + '/models') : '')
  if (typeof endpointValue !== 'string' || !endpointValue.trim()) throw Object.assign(new Error('adapter endpoint is required'), { code: 'ADAPTER_CONFIG_INVALID' })
  let endpoint
  try { endpoint = new URL(endpointValue) } catch { throw Object.assign(new Error('adapter endpoint must be a valid URL'), { code: 'ADAPTER_CONFIG_INVALID' }) }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !['https:', 'http:'].includes(endpoint.protocol)) {
    throw Object.assign(new Error('adapter endpoint must not contain credentials, query, or hash'), { code: 'ADAPTER_CONFIG_INVALID' })
  }
  if (endpoint.protocol === 'http:' && !privateHttpHost(endpoint.hostname)) {
    throw Object.assign(new Error('adapter endpoint must use https outside loopback'), { code: 'ADAPTER_CONFIG_INVALID' })
  }
  const auth = source.auth === undefined ? 'bearer' : String(source.auth)
  if (!SAFE_AUTH.has(auth)) throw Object.assign(new Error('adapter auth mode is unsupported'), { code: 'ADAPTER_CONFIG_INVALID' })
  const parse = source.parser === undefined ? 'openai' : String(source.parser)
  if (!SAFE_PARSERS.has(parse)) throw Object.assign(new Error('adapter parser is unsupported'), { code: 'ADAPTER_CONFIG_INVALID' })
  const headers = {}
  if (source.headers !== undefined) {
    if (!source.headers || typeof source.headers !== 'object' || Array.isArray(source.headers)) throw Object.assign(new Error('adapter headers must be an object'), { code: 'ADAPTER_CONFIG_INVALID' })
    for (const [key, value] of Object.entries(source.headers).slice(0, 20)) {
      if (!/^[A-Za-z0-9-]{1,64}$/.test(key) || BLOCKED_HEADERS.test(key) || typeof value !== 'string' || value.length > 256 || !/^[\x20-\x7E]*$/.test(value)) {
        throw Object.assign(new Error('adapter headers contain an unsafe field'), { code: 'ADAPTER_CONFIG_INVALID' })
      }
      headers[key] = value
    }
  }
  const modelsPath = typeof source.modelsPath === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(source.modelsPath.trim()) ? source.modelsPath.trim() : 'data'
  const capabilityMap = source.capabilityMap && typeof source.capabilityMap === 'object' && !Array.isArray(source.capabilityMap) ? structuredClone(source.capabilityMap) : {}
  for (const key of Object.keys(capabilityMap)) if (!CAPABILITIES.has(key)) delete capabilityMap[key]
  const fields = source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields) ? structuredClone(source.fields) : {}
  for (const key of Object.keys(fields)) if (!['id', 'name', 'description', 'contextWindow', 'maxTokens', 'pricing', 'tags'].includes(key) || typeof fields[key] !== 'string' || fields[key].length > 128) delete fields[key]
  for (const key of Object.keys(capabilityMap)) {
    const values = Array.isArray(capabilityMap[key]) ? capabilityMap[key] : [capabilityMap[key]]
    capabilityMap[key] = values.filter((value) => typeof value === 'string' && value.length <= 128).slice(0, 8)
  }
  return { endpoint: endpoint.toString(), auth, parse, headers, modelsPath, capabilityMap, fields }
}

async function requestSpecific(profile, descriptor, { resolveCredential, fetchImpl, signal }) {
  const apiKey = profile.apiKeyEnv ? await resolveCredential(profile.apiKeyEnv) : ''
  const url = new URL(descriptor.endpoint)
  const headers = { Accept: 'application/json', ...(descriptor.headers ?? {}) }
  if (descriptor.auth === 'bearer' && apiKey) headers.Authorization = 'Bearer ' + apiKey
  if (descriptor.auth === 'x-api-key' && apiKey) headers['x-api-key'] = apiKey
  if (descriptor.auth === 'query-key' && apiKey) url.searchParams.set('key', apiKey)
  let response
  try { response = await fetchImpl(url, { headers, signal }) } catch (error) {
    if (error && typeof error === 'object') error.adapterCode = 'endpoint'
    throw error
  }
  if (!response.ok) {
    const error = catalogRequestError(response.status, response)
    error.adapterCode = [401, 403].includes(response.status) ? 'auth' : response.status === 429 ? 'rate-limit' : 'http'
    throw error
  }
  return response
}

async function fetchSpecific(profile, descriptor, options) {
  let payload
  try {
    const response = await requestSpecific(profile, descriptor, options)
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      const error = new Error('model catalog response is too large')
      error.adapterCode = 'schema'
      throw error
    }
    try { payload = JSON.parse(text) } catch {
      const error = new Error('model catalog response is not valid JSON')
      error.adapterCode = 'schema'
      throw error
    }
    const rows = parseRows(profile.provider, payload, descriptor)
    if (Array.isArray(rows) && rows.length > 0) return rows
  } catch (error) {
    if (descriptor.defaultModels && Array.isArray(descriptor.defaultModels) && descriptor.defaultModels.length > 0) {
      return normalizeModels(profile.provider, descriptor.defaultModels.map((id) => ({ id })))
    }
    throw error
  }
  if (descriptor.defaultModels && Array.isArray(descriptor.defaultModels) && descriptor.defaultModels.length > 0) {
    return normalizeModels(profile.provider, descriptor.defaultModels.map((id) => ({ id })))
  }
  return []
}

async function probeSpecific(profile, descriptor, options) {
  const startedAt = Date.now()
  const response = await requestSpecific(profile, descriptor, options)
  if (typeof response.body?.cancel === 'function') await response.body.cancel()
  return { statusCode: response.status, latencyMs: Date.now() - startedAt }
}

export function createProviderAdapterRegistry({ resolveCredential, fetchImpl = fetch, adapters = {} } = {}) {
  const generic = createGenericAdapter({ resolveCredential, fetchImpl })
  const explicit = new Map()
  for (const [id, adapter] of Object.entries(adapters ?? {})) {
    if (adapter?.discover && adapter?.health) explicit.set(id, Object.freeze({ id: 'explicit:' + id, canHandle: adapter.canHandle ?? (() => true), discover: adapter.discover, health: adapter.health }))
  }
  function register(id, adapter) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(id) || !adapter?.discover || !adapter?.health) {
      throw Object.assign(new Error('adapter implementation must expose discover and health'), { code: 'ADAPTER_IMPLEMENTATION_INVALID' })
    }
    const normalized = Object.freeze({ id: 'explicit:' + id, canHandle: adapter.canHandle ?? (() => true), discover: adapter.discover, health: adapter.health })
    explicit.set(id, normalized)
    return normalized
  }
  function declarative(profile, config) {
    const descriptor = normalizeAdapterConfig(config, profile)
    return Object.freeze({
      id: 'declarative:' + profile.provider,
      canHandle: () => true,
      discover: (current, options = {}) => fetchSpecific(current, descriptor, { resolveCredential, fetchImpl, ...options }),
      health: (current, options = {}) => probeSpecific(current, descriptor, { resolveCredential, fetchImpl, ...options }),
      descriptor,
    })
  }
  const registry = {
    descriptors: PROVIDER_ADAPTERS,
    register,
    select(profile, config) {
      if (profile?.adapterId && explicit.has(profile.adapterId)) return explicit.get(profile.adapterId)
      if (config && config.enabled !== false && (config.endpoint || profile?.baseURL)) return declarative(profile, config)
      if (canUseGenericAdapter(profile)) return generic
      const descriptor = PROVIDER_ADAPTERS[profile?.provider]
      if (!descriptor) return null
      return Object.freeze({
        id: 'provider:' + profile.provider,
        canHandle: () => true,
        discover: (current, options = {}) => fetchSpecific(current, { ...descriptor, modelsPath: 'data', fields: {}, capabilityMap: {} }, { resolveCredential, fetchImpl, ...options }),
        health: (current, options = {}) => probeSpecific(current, descriptor, { resolveCredential, fetchImpl, ...options }),
      })
    },
  }
  return Object.freeze(registry)
}
