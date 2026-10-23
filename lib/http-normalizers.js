/**
 * Request body and parameter normalizers for HTTP API routes (#274).
 */

import { isForbiddenWebhookHost, isLoopbackHost } from './diff-notifier.js'
import { validateAliasName } from './alias-resolver.js'
import { validatePolicy } from './policy.js'

export function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    let failed = false
    req.on('data', (chunk) => {
      if (failed) return
      raw += chunk
      if (raw.length > 64 * 1024) {
        failed = true
        const err = new Error('request body is too large')
        if (typeof req.destroy === 'function') req.destroy(err)
        reject(err)
      }
    })
    req.on('end', () => {
      if (failed) return
      try { resolve(JSON.parse(raw || '{}')) } catch (error) { reject(error) }
    })
    req.on('error', (err) => {
      if (failed) return
      reject(err)
    })
  })
}

export function normalizeWebhookTestRequest(body) {
  if (!body || typeof body !== 'object') throw Object.assign(new Error('body is required'), { code: 'INVALID_REQUEST' })
  if (typeof body.url !== 'string' || !body.url.trim()) throw Object.assign(new Error('url is required'), { code: 'INVALID_REQUEST' })
  let parsed
  try {
    parsed = new URL(body.url.trim())
  } catch (err) {
    throw Object.assign(new Error('Invalid URL: ' + (err?.message || String(err))), { code: 'INVALID_REQUEST' })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error('URL must use http or https protocol'), { code: 'INVALID_REQUEST' })
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isForbiddenWebhookHost(hostname)) {
    throw Object.assign(new Error('webhook url targets a forbidden metadata or link-local address'), { code: 'INVALID_REQUEST' })
  }
  const isLoopback = isLoopbackHost(hostname)
  if (parsed.protocol === 'http:' && !isLoopback) {
    throw Object.assign(new Error('insecure http webhook url is only permitted on loopback'), { code: 'INVALID_REQUEST' })
  }
  return {
    url: parsed.toString(),
    secret: typeof body.secret === 'string' ? body.secret.trim() : '',
    ...(body.secretRef && typeof body.secretRef === 'string' ? { secretRef: body.secretRef.trim() } : {}),
  }
}

export function normalizeRunRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (body.provider !== undefined && (typeof body.provider !== 'string' || body.provider.length > 128)) throw new Error('provider must be a short string')
  if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') throw new Error('dryRun must be boolean')
  if (body.removeMissing !== undefined && typeof body.removeMissing !== 'boolean') throw new Error('removeMissing must be boolean')
  return {
    ...(body.provider ? { provider: body.provider } : {}),
    dryRun: body.dryRun !== false,
    removeMissing: body.removeMissing === true,
  }
}

export function normalizeCredentialRequest(url = '') {
  const parsed = new URL(url || '/', 'http://dsh-model-sync.local')
  const provider = parsed.searchParams.get('provider') || undefined
  if (provider && (provider.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(provider))) throw new Error('provider must be a short string')
  return provider ? { provider } : {}
}

export function normalizeNotificationRequest(url = '') {
  const parsed = new URL(url || '/', 'http://dsh-model-sync.local')
  return { includeAcknowledged: parsed.searchParams.get('includeAcknowledged') !== 'false' }
}

export function normalizeNotificationAction(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (typeof body.id !== 'string' || !body.id || body.id.length > 128) throw new Error('notification id is invalid')
  return { id: body.id.trim() }
}

export function normalizeCredentialCheckRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (body.provider !== undefined && (typeof body.provider !== 'string' || body.provider.length > 128)) throw new Error('provider must be a short string')
  return body.provider ? { provider: body.provider.trim() } : {}
}

export function normalizeTryRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (typeof body.provider !== 'string' || !body.provider) throw new Error('provider is required')
  if (typeof body.model !== 'string' || !body.model) throw new Error('model is required')
  return { provider: body.provider, model: body.model }
}

export function normalizeBatchTryRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (typeof body.provider !== 'string' || !body.provider) throw new Error('provider is required')
  if (!Array.isArray(body.models)) throw new Error('models must be an array')
  return {
    provider: body.provider.trim(),
    models: body.models.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim()),
  }
}

export function normalizeAliasRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (typeof body.alias !== 'string' || !body.alias.trim()) throw new Error('alias is required')
  if (!validateAliasName(body.alias)) throw new Error('alias must be 1-64 alphanumeric characters, @ or _-.')
  if (body.action === 'delete') return { action: 'delete', alias: body.alias.trim() }
  if (Array.isArray(body.targets) && body.targets.length > 0) {
    if (body.targets.length > 50) throw new Error('targets array is too long')
    for (const t of body.targets) {
      if (typeof t === 'string') {
        if (!t || t.length > 256) throw new Error('target must be a short string')
      } else if (t && typeof t === 'object') {
        if (typeof t.provider !== 'string' || !t.provider || t.provider.length > 128) throw new Error('target provider must be a short string')
        if (typeof t.model !== 'string' || !t.model || t.model.length > 256) throw new Error('target model must be a short string')
      } else {
        throw new Error('invalid target format')
      }
    }
    return { action: 'set', alias: body.alias.trim(), targets: body.targets }
  }
  if (typeof body.strategy === 'string' && body.strategy.trim()) {
    if (body.strategy.length > 64) throw new Error('strategy must be a short string')
    return { action: 'set', alias: body.alias.trim(), strategy: body.strategy.trim() }
  }
  if (typeof body.provider !== 'string' || !body.provider.trim() || body.provider.length > 128) throw new Error('provider must be a short string')
  if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 256) throw new Error('model must be a short string')
  return { action: 'set', alias: body.alias.trim(), provider: body.provider.trim(), model: body.model.trim() }
}

export function normalizeHealthRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (body.provider !== undefined && (typeof body.provider !== 'string' || body.provider.length > 128)) throw new Error('provider must be a short string')
  return body.provider ? { provider: body.provider } : {}
}

export function normalizePolicyRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (typeof body.provider !== 'string' || !body.provider || body.provider.length > 128) throw new Error('provider must be a short string')
  for (const field of ['include', 'exclude']) {
    if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].length > 100)) throw new Error(`${field} must be an array`)
    if (Array.isArray(body[field]) && body[field].some((value) => typeof value !== 'string' || value.length > 256)) throw new Error(`${field} patterns must be short strings`)
  }
  for (const field of ['requireCapabilities', 'denyCapabilities']) {
    if (body[field] !== undefined && (!body[field] || typeof body[field] !== 'object' || Array.isArray(body[field]))) throw new Error(`${field} must be an object`)
    if (body[field] && Object.keys(body[field]).length > 4) throw new Error(`${field} has too many capabilities`)
    if (body[field] && Object.values(body[field]).some((value) => typeof value !== 'boolean')) throw new Error(`${field} values must be boolean`)
  }
  return {
    provider: body.provider.trim(),
    policy: validatePolicy({
      include: body.include,
      exclude: body.exclude,
      requireCapabilities: body.requireCapabilities,
      denyCapabilities: body.denyCapabilities,
      enableCostFilter: body.enableCostFilter,
      maxPricePerMillion: body.maxPricePerMillion,
      enableContextFilter: body.enableContextFilter,
      minContextTokens: body.minContextTokens,
    }),
  }
}

export function normalizeHistoryRequest(url = '') {
  const parsed = new URL(url || '/', 'http://dsh-model-sync.local')
  const limitValue = Number(parsed.searchParams.get('limit') ?? 50)
  const limit = Number.isFinite(limitValue) ? Math.min(100, Math.max(1, Math.floor(limitValue))) : 50
  const provider = parsed.searchParams.get('provider') || undefined
  const historyId = parsed.searchParams.get('historyId') || undefined
  if (provider && provider.length > 128) throw new Error('provider must be a short string')
  if (historyId && historyId.length > 128) throw new Error('historyId must be a short string')
  return { limit, ...(provider ? { provider } : {}), ...(historyId ? { historyId } : {}), details: parsed.searchParams.get('details') === 'true' }
}

export function normalizeHistoryRollbackRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (typeof body.historyId !== 'string' || !body.historyId || body.historyId.length > 128) throw new Error('historyId must be a short string')
  if (typeof body.provider !== 'string' || !body.provider || body.provider.length > 128) throw new Error('provider must be a short string')
  return { historyId: body.historyId.trim(), provider: body.provider.trim() }
}

export function normalizeSelectionRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object')
  if (typeof body.provider !== 'string' || !body.provider || body.provider.length > 128) throw new Error('provider must be a short string')
  if (!Array.isArray(body.models) || body.models.length > 5000) throw new Error('models must be an array')
  const models = []
  const seen = new Set()
  for (const model of body.models) {
    if (typeof model !== 'string' || model.length > 512) throw new Error('model ids must be short strings')
    const id = model.trim()
    if (id && !seen.has(id)) {
      seen.add(id)
      models.push(id)
    }
  }
  return { provider: body.provider, models }
}
