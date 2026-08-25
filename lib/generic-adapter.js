import { catalogRequestError } from './reliability.js'
import { normalizeModels } from './models.js'

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const SUPPORTED_APIS = new Set(['openai-completions', 'openai-responses'])

function endpointFor(baseURL) {
  const base = String(baseURL ?? '').trim().replace(/\/+$/, '')
  if (!base) throw new Error('missing baseURL')
  return base.endsWith('/models') ? base : `${base}/models`
}

async function readBody(response) {
  const declared = Number(response.headers?.get?.('content-length') ?? NaN)
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error('model catalog response is too large')
  }
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('model catalog response is too large')
  }
  return text
}

function rowsFrom(payload) {
  const rows = payload?.data ?? payload?.models ?? payload?.availableModels
  return Array.isArray(rows) ? rows : []
}

export function canUseGenericAdapter(profile) {
  return Boolean(profile?.baseURL) && SUPPORTED_APIS.has(profile?.api || 'openai-completions')
}

export async function discoverOpenAIModels(profile, {
  resolveCredential,
  fetchImpl = fetch,
  signal,
} = {}) {
  if (!canUseGenericAdapter(profile)) {
    throw new Error('generic discovery requires an OpenAI-compatible baseURL and protocol')
  }
  const apiKey = profile.apiKeyEnv ? await resolveCredential(profile.apiKeyEnv) : ''
  const headers = { Accept: 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const response = await fetchImpl(endpointFor(profile.baseURL), { headers, signal })
  if (!response.ok) throw catalogRequestError(response.status)
  let payload
  try {
    payload = JSON.parse(await readBody(response))
  } catch {
    throw new Error('model catalog response is not valid JSON')
  }
  return normalizeModels(profile.provider ?? '', rowsFrom(payload))
}

export function createGenericAdapter({ resolveCredential, fetchImpl = fetch } = {}) {
  return Object.freeze({
    id: 'openai-compatible',
    canHandle: canUseGenericAdapter,
    discover(profile, options = {}) {
      return discoverOpenAIModels(profile, {
        resolveCredential,
        fetchImpl,
        ...options,
      })
    },
  })
}
