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

function requestHeaders(apiKey, etag, lastModified) {
  const headers = { Accept: 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (etag) headers['If-None-Match'] = etag
  if (lastModified) headers['If-Modified-Since'] = lastModified
  return headers
}

async function resolveGenericRequest(profile, { resolveCredential, fetchImpl, signal, etag, lastModified }) {
  const keyRef = profile.apiKeyEnv || profile.credentialRef || profile.apiKeyRef
  const apiKey = keyRef ? await resolveCredential(keyRef) : ''
  const response = await fetchImpl(endpointFor(profile.baseURL), { headers: requestHeaders(apiKey, etag, lastModified), signal })
  if (response.status === 304) return response
  if (!response.ok) throw catalogRequestError(response.status, response)
  return response
}

export async function discoverOpenAIModels(profile, {
  resolveCredential,
  fetchImpl = fetch,
  signal,
  etag,
  lastModified,
} = {}) {
  if (!canUseGenericAdapter(profile)) {
    throw new Error('generic discovery requires an OpenAI-compatible baseURL and protocol')
  }
  const response = await resolveGenericRequest(profile, { resolveCredential, fetchImpl, signal, etag, lastModified })
  if (response.status === 304) {
    return { notModified: true, etag: response.headers?.get?.('etag') || etag, lastModified: response.headers?.get?.('last-modified') || lastModified }
  }
  const respEtag = response.headers?.get?.('etag') || undefined
  const respLastMod = response.headers?.get?.('last-modified') || undefined
  let payload
  try {
    payload = JSON.parse(await readBody(response))
  } catch {
    throw new Error('model catalog response is not valid JSON')
  }
  const models = normalizeModels(profile.provider ?? '', rowsFrom(payload))
  if (respEtag || respLastMod) {
    Object.defineProperty(models, '__httpMeta', {
      value: { etag: respEtag, lastModified: respLastMod },
      enumerable: false,
      configurable: true,
    })
  }
  return models
}


export async function probeOpenAIModels(profile, {
  resolveCredential,
  fetchImpl = fetch,
  signal,
} = {}) {
  if (!canUseGenericAdapter(profile)) {
    throw new Error('generic health probe requires an OpenAI-compatible baseURL and protocol')
  }
  const startedAt = Date.now()
  const response = await resolveGenericRequest(profile, { resolveCredential, fetchImpl, signal })
  if (typeof response.body?.cancel === 'function') await response.body.cancel()
  return { statusCode: response.status, latencyMs: Date.now() - startedAt }
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
    health(profile, options = {}) {
      return probeOpenAIModels(profile, {
        resolveCredential,
        fetchImpl,
        ...options,
      })
    },
  })
}
