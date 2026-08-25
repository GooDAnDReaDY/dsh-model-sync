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

export function registerHttpApi(ctx, synchronizer) {
  const makeHandler = (route) => async (req, res) => {
    if (!trusted(req)) return json(res, 403, { error: { code: 'forbidden', message: 'dsh-model-sync: cross-origin request rejected' } })
    if (route === 'status') {
      if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
      return json(res, 200, { ...synchronizer.status(), providers: synchronizer.listProviders() })
    }
    if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
    let options
    try {
      const body = await readJson(req)
      options = route === 'selection'
        ? normalizeSelectionRequest(body)
        : route === 'policy' ? normalizePolicyRequest(body)
        : route === 'health' ? normalizeHealthRequest(body) : normalizeRunRequest(body)
    }
    catch (error) { return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } }) }
    try {
      const result = route === 'selection'
        ? await synchronizer.setModelSelection(options.provider, options.models)
        : route === 'policy' ? await synchronizer.setModelPolicy(options.provider, options.policy)
        : route === 'health' ? await synchronizer.health(options) : await synchronizer.run(options)
      return json(res, 200, { ...result, providers: synchronizer.listProviders() })
    }
    catch (error) {
      const code = error?.code === 'SETTINGS_CONFLICT' ? 409 : error?.code === 'SETTINGS_UNAVAILABLE' || error?.code === 'CONFIG_UNAVAILABLE' ? 503 : error?.code === 'PROVIDER_NOT_CONFIGURED' || error?.code === 'UNKNOWN_MODEL' || error?.code === 'INVALID_POLICY' ? 400 : 500
      return json(res, code, { error: { code: error?.code ?? 'run-failed', message: error instanceof Error ? error.message : String(error) } })
    }
  }
  return [
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/status`, handler: makeHandler('status') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/run`, handler: makeHandler('run') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/health`, handler: makeHandler('health') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/selection`, handler: makeHandler('selection') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/policy`, handler: makeHandler('policy') }),
  ]
}
