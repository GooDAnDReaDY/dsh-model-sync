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

export function registerHttpApi(ctx, synchronizer) {
  const makeHandler = (route) => async (req, res) => {
    if (!trusted(req)) return json(res, 403, { error: { code: 'forbidden', message: 'dsh-model-sync: cross-origin request rejected' } })
    if (route === 'status') {
      if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
      return json(res, 200, { ...synchronizer.status(), providers: synchronizer.listProviders() })
    }
    if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
    let options
    try { options = normalizeRunRequest(await readJson(req)) }
    catch (error) { return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } }) }
    try { const result = await synchronizer.run(options); return json(res, 200, { ...result, providers: synchronizer.listProviders() }) }
    catch (error) {
      const code = error?.code === 'SETTINGS_CONFLICT' ? 409 : error?.code === 'SETTINGS_UNAVAILABLE' ? 503 : 500
      return json(res, code, { error: { code: error?.code ?? 'run-failed', message: error instanceof Error ? error.message : String(error) } })
    }
  }
  return [
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/status`, handler: makeHandler('status') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/run`, handler: makeHandler('run') }),
  ]
}
