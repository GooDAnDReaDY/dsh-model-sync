import { catalogRequestError } from './reliability.js'
import { normalizeModels } from './models.js'

export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const SUPPORTED_APIS = new Set(['openai-completions', 'openai-responses'])

function endpointFor(baseURL) {
  const base = String(baseURL ?? '').trim().replace(/\/+$/, '')
  if (!base) throw new Error('missing baseURL')
  return base.endsWith('/models') ? base : `${base}/models`
}

export async function readBoundedText(response, maxBytes = MAX_RESPONSE_BYTES) {
  const declared = Number(response.headers?.get?.('content-length') ?? NaN)
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error('model catalog response is too large')
  }

  if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    const chunks = []
    let totalBytes = 0
    for await (const chunk of response.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buf.byteLength
      if (totalBytes > maxBytes) {
        if (typeof response.body.cancel === 'function') {
          try { await response.body.cancel('response too large') } catch (_err) { /* best-effort */ }
        } else if (typeof response.body.destroy === 'function') {
          try { response.body.destroy() } catch (_err) { /* best-effort */ }
        }
        throw new Error('model catalog response is too large')
      }
      chunks.push(buf)
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    const chunks = []
    let totalBytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          const buf = Buffer.isBuffer(value) ? value : Buffer.from(value)
          totalBytes += buf.byteLength
          if (totalBytes > maxBytes) {
            try { await reader.cancel('response too large') } catch (_err) { /* best-effort */ }
            throw new Error('model catalog response is too large')
          }
          chunks.push(buf)
        }
      }
    } finally {
      try { reader.releaseLock?.() } catch (_err) { /* best-effort */ }
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  if (typeof response.text === 'function') {
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error('model catalog response is too large')
    }
    return text
  }

  return ''
}

async function readBody(response) {
  return readBoundedText(response, MAX_RESPONSE_BYTES)
}

function rowsFrom(payload) {
  if (payload && (payload.error || payload.errors)) {
    const message = typeof payload.error === 'string'
      ? payload.error
      : payload.error?.message || (Array.isArray(payload.errors) ? payload.errors.map(e => e?.message || e).join(', ') : 'endpoint returned error payload')
    const err = new Error(`endpoint returned error payload: ${message}`)
    err.adapterCode = 'schema'
    throw err
  }
  const rows = Array.isArray(payload) ? payload : (payload?.data ?? payload?.models ?? payload?.availableModels)
  if (!Array.isArray(rows)) {
    const err = new Error('model catalog response does not contain models array')
    err.adapterCode = 'schema'
    throw err
  }
  return rows
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
