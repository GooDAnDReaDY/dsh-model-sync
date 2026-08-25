import { validatePolicy } from './policy.js'

const BASE = '/dsh-model-sync'

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function trusted(req) {
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers?.origin
  if (!origin) return true
  const host = req.headers?.host
  if (!host) return false
  try { return new URL(origin).host === host } catch { return false }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 64 * 1024) reject(new Error('request body is too large'))
    })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
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

export function registerHttpApi(ctx, synchronizer, { getSchedulerStatus = () => null } = {}) {
  const makeHandler = (route) => async (req, res) => {
    if (!trusted(req)) return json(res, 403, { error: { code: 'forbidden', message: 'dsh-model-sync: cross-origin request rejected' } })
    if (route === 'status') {
      if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
      return json(res, 200, { ...synchronizer.status(), scheduler: getSchedulerStatus(), providers: synchronizer.listProviders() })
    }
    if (route === 'history') {
      if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
      try { return json(res, 200, { history: synchronizer.history(normalizeHistoryRequest(req.url)) }) }
      catch (error) { return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } }) }
    }
    if (route === 'credentials') {
      if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
      try { return json(res, 200, await synchronizer.credentialDiagnostics(normalizeCredentialRequest(req.url))) }
      catch (error) { return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } }) }
    }
    if (route === 'report') {
      if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
      return json(res, 200, { report: synchronizer.report() })
    }
    if (route === 'notifications') {
      if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
      return json(res, 200, { notifications: synchronizer.notifications(normalizeNotificationRequest(req.url)) })
    }
    if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
    let options
    try {
      const body = await readJson(req)
      options = route === 'selection'
        ? normalizeSelectionRequest(body)
        : route === 'policy' ? normalizePolicyRequest(body)
        : route === 'health' ? normalizeHealthRequest(body)
        : route === 'credentials-check' ? normalizeCredentialCheckRequest(body)
        : route === 'notification-read' || route === 'notification-acknowledge' ? normalizeNotificationAction(body)
        : route === 'rollback' ? normalizeHistoryRollbackRequest(body)
        : normalizeRunRequest(body)
    }
    catch (error) { return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } }) }
    try {
      const result = route === 'selection'
        ? await synchronizer.setModelSelection(options.provider, options.models)
        : route === 'policy' ? await synchronizer.setModelPolicy(options.provider, options.policy)
        : route === 'health' ? await synchronizer.health(options)
        : route === 'credentials-check' ? { health: await synchronizer.health(options), credentials: await synchronizer.credentialDiagnostics(options) }
        : route === 'notification-read' ? await synchronizer.updateNotification(options.id, 'read')
        : route === 'notification-acknowledge' ? await synchronizer.updateNotification(options.id, 'acknowledged')
        : route === 'rollback' ? await synchronizer.rollbackHistory(options)
        : await synchronizer.run(options)
      return json(res, 200, { ...result, providers: synchronizer.listProviders() })
    }
    catch (error) {
      const code = error?.code === 'SETTINGS_CONFLICT' ? 409 : error?.code === 'SETTINGS_UNAVAILABLE' || error?.code === 'CONFIG_UNAVAILABLE' ? 503 : error?.code === 'PROVIDER_NOT_CONFIGURED' || error?.code === 'UNKNOWN_MODEL' || error?.code === 'INVALID_POLICY' || error?.code === 'INVALID_HISTORY' || error?.code === 'HISTORY_NOT_FOUND' || error?.code === 'INVALID_NOTIFICATION' || error?.code === 'NOTIFICATION_NOT_FOUND' ? 400 : 500
      return json(res, code, { error: { code: error?.code ?? 'run-failed', message: error instanceof Error ? error.message : String(error) } })
    }
  }
  return [
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/status`, handler: makeHandler('status') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/run`, handler: makeHandler('run') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/health`, handler: makeHandler('health') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/selection`, handler: makeHandler('selection') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/policy`, handler: makeHandler('policy') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/history`, handler: makeHandler('history') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/history/rollback`, handler: makeHandler('rollback') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/credentials`, handler: makeHandler('credentials') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/credentials/check`, handler: makeHandler('credentials-check') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/report', handler: makeHandler('report') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/notifications', handler: makeHandler('notifications') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/notifications/read', handler: makeHandler('notification-read') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/notifications/acknowledge', handler: makeHandler('notification-acknowledge') }),
  ]
}
