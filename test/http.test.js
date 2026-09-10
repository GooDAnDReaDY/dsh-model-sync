import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { normalizeCredentialCheckRequest, normalizeCredentialRequest, normalizeHealthRequest, normalizeHistoryRequest, normalizeHistoryRollbackRequest, normalizeNotificationAction, normalizeNotificationRequest, normalizePolicyRequest, normalizeRunRequest, normalizeSelectionRequest, normalizeTryRequest, registerHttpApi } from '../lib/http.js'

test('normalizes run requests to a safe dry-run default', () => {
  assert.deepEqual(normalizeRunRequest({}), { dryRun: true, removeMissing: false })
  assert.deepEqual(normalizeRunRequest({ provider: 'openai', dryRun: false, removeMissing: true }), { provider: 'openai', dryRun: false, removeMissing: true })
  assert.throws(() => normalizeRunRequest({ dryRun: 'false' }), /dryRun must be boolean/)
})

test('normalizes health requests without accepting run mutations', () => {
  assert.deepEqual(normalizeHealthRequest({}), {})
  assert.deepEqual(normalizeHealthRequest({ provider: 'openai', dryRun: false }), { provider: 'openai' })
  assert.throws(() => normalizeHealthRequest({ provider: 7 }), /provider must be a short string/)
})

test('normalizes model policy requests and validates regex inputs', () => {
  assert.deepEqual(normalizePolicyRequest({ provider: 'openai', include: ['gpt-.*'], requireCapabilities: { vision: true } }), {
    provider: 'openai',
    policy: { include: ['gpt-.*'], exclude: [], requireCapabilities: { vision: true }, denyCapabilities: {} },
  })
  assert.throws(() => normalizePolicyRequest({ provider: 'openai', include: ['['] }), /invalid include pattern/)
})

test('normalizes credential diagnostics requests', () => {
  assert.deepEqual(normalizeCredentialRequest('/dsh-model-sync/credentials?provider=openai'), { provider: 'openai' })
  assert.deepEqual(normalizeCredentialCheckRequest({ provider: 'openai' }), { provider: 'openai' })
  assert.throws(() => normalizeCredentialRequest('/dsh-model-sync/credentials?provider=bad%20provider'), /provider must be a short string/)
})

test('normalizes report and notification requests', () => {
  assert.deepEqual(normalizeNotificationRequest('/dsh-model-sync/notifications?includeAcknowledged=false'), { includeAcknowledged: false })
  assert.deepEqual(normalizeNotificationAction({ id: 'sync-notice-1' }), { id: 'sync-notice-1' })
  assert.throws(() => normalizeNotificationAction({ id: '' }), /notification id is invalid/)
})

test('normalizes history requests and rollback payloads', () => {
  assert.deepEqual(normalizeHistoryRequest('/dsh-model-sync/history?limit=5&provider=openai&details=true'), { limit: 5, provider: 'openai', details: true })
  assert.deepEqual(normalizeHistoryRollbackRequest({ historyId: 'sync-1-2', provider: 'openai' }), { historyId: 'sync-1-2', provider: 'openai' })
  assert.throws(() => normalizeHistoryRollbackRequest({ historyId: '', provider: 'openai' }), /historyId must be a short string/)
})

test('normalizes model selection requests and deduplicates ids', () => {
  assert.deepEqual(normalizeSelectionRequest({ provider: 'openai', models: ['a', ' a ', 'b'] }), { provider: 'openai', models: ['a', 'b'] })
  assert.throws(() => normalizeSelectionRequest({ provider: 'openai', models: 'a' }), /models must be an array/)
})

test('registers separate exact status and run endpoints', () => {
  const routes = []
  const ctx = { webServer: { register: (route) => { routes.push(route); return () => {} } } }
  const sync = { status: () => ({ running: false }), listProviders: () => [], run: async () => ({}), health: async () => ({ results: [] }), setModelSelection: async () => ({}), setModelPolicy: async () => ({}) }
  const disposers = registerHttpApi(ctx, sync)
  assert.equal(routes.length, 14)
  assert.deepEqual(routes.map((route) => [route.kind, route.path]), [
    ['exact', '/dsh-model-sync/status'],
    ['exact', '/dsh-model-sync/run'],
    ['exact', '/dsh-model-sync/try'],
    ['exact', '/dsh-model-sync/health'],
    ['exact', '/dsh-model-sync/selection'],
    ['exact', '/dsh-model-sync/policy'],
    ['exact', '/dsh-model-sync/history'],
    ['exact', '/dsh-model-sync/history/rollback'],
    ['exact', '/dsh-model-sync/credentials'],
    ['exact', '/dsh-model-sync/credentials/check'],
    ['exact', '/dsh-model-sync/report'],
    ['exact', '/dsh-model-sync/notifications'],
    ['exact', '/dsh-model-sync/notifications/read'],
    ['exact', '/dsh-model-sync/notifications/acknowledge'],
  ])
  assert.equal(disposers.length, 14)
})

test('rejects cross-site and mismatched origin requests', async () => {
  const routes = new Map()
  const ctx = { webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } } }
  const sync = { status: () => ({ running: false }), listProviders: () => [] }
  registerHttpApi(ctx, sync)
  const statusHandler = routes.get('/dsh-model-sync/status')

  const createMockRes = () => {
    const res = {
      status: 0,
      headers: {},
      body: '',
      writeHead(s, h) { this.status = s; this.headers = h },
      end(b) { this.body = b },
    }
    return res
  }

  // Cross-site fetch header
  const crossSiteRes = createMockRes()
  await statusHandler({ method: 'GET', headers: { 'sec-fetch-site': 'cross-site', host: 'localhost:3000' } }, crossSiteRes)
  assert.equal(crossSiteRes.status, 403)

  // Mismatched origin
  const badOriginRes = createMockRes()
  await statusHandler({ method: 'GET', headers: { origin: 'http://malicious.site', host: 'localhost:3000' } }, badOriginRes)
  assert.equal(badOriginRes.status, 403)

  // Valid same-origin
  const validRes = createMockRes()
  await statusHandler({ method: 'GET', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' } }, validRes)
  assert.equal(validRes.status, 200)
})


test('normalizes try requests and validates model and provider', () => {
  assert.deepEqual(normalizeTryRequest({ provider: 'openai', model: 'gpt-5' }), { provider: 'openai', model: 'gpt-5' })
  assert.throws(() => normalizeTryRequest({ provider: 123, model: 'gpt-5' }), /provider is required/)
  assert.throws(() => normalizeTryRequest({ provider: 'openai', model: '' }), /model is required/)
  assert.throws(() => normalizeTryRequest('not-an-object'), /request body must be an object/)
})

test('handles try, history, credentials, report and notification routes via HTTP handlers', async () => {
  const routes = new Map()
  const ctx = { webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } } }
  let tryCalledWith = null
  let noticeActionCalled = null
  const sync = {
    status: () => ({ running: false }),
    listProviders: () => [{ provider: 'openai', configured: true }],
    history: () => [{ id: 'hist-1', version: 1 }],
    credentialDiagnostics: async () => ({ results: [] }),
    report: () => ({ total: 1 }),
    notifications: () => [{ id: 'n-1' }],
    tryModel: async (opts) => { tryCalledWith = opts; return { provider: opts.provider, model: opts.model, ok: true, latencyMs: 42 } },
    updateNotification: async (id, action) => { noticeActionCalled = { id, action }; return { id, read: true } },
    rollbackHistory: async () => ({ applied: true }),
  }
  registerHttpApi(ctx, sync)

  const createMockRes = () => ({
    status: 0,
    headers: {},
    body: '',
    writeHead(s, h) { this.status = s; this.headers = h },
    end(b) { this.body = b },
  })

  const makeReq = (method, path, body = null) => {
    const req = new EventEmitter()
    req.method = method
    req.url = path
    req.headers = { host: 'localhost:3000', origin: 'http://localhost:3000' }
    if (body !== null) {
      process.nextTick(() => {
        req.emit('data', Buffer.from(JSON.stringify(body)))
        req.emit('end')
      })
    } else {
      process.nextTick(() => req.emit('end'))
    }
    return req
  }

  // GET /dsh-model-sync/history
  const histRes = createMockRes()
  await routes.get('/dsh-model-sync/history')(makeReq('GET', '/dsh-model-sync/history?limit=2'), histRes)
  assert.equal(histRes.status, 200)
  assert.equal(JSON.parse(histRes.body).history.length, 1)

  // GET /dsh-model-sync/credentials
  const credRes = createMockRes()
  await routes.get('/dsh-model-sync/credentials')(makeReq('GET', '/dsh-model-sync/credentials'), credRes)
  assert.equal(credRes.status, 200)

  // GET /dsh-model-sync/report
  const repRes = createMockRes()
  await routes.get('/dsh-model-sync/report')(makeReq('GET', '/dsh-model-sync/report'), repRes)
  assert.equal(repRes.status, 200)

  // GET /dsh-model-sync/notifications
  const notRes = createMockRes()
  await routes.get('/dsh-model-sync/notifications')(makeReq('GET', '/dsh-model-sync/notifications'), notRes)
  assert.equal(notRes.status, 200)

  // POST /dsh-model-sync/try
  const tryRes = createMockRes()
  await routes.get('/dsh-model-sync/try')(makeReq('POST', '/dsh-model-sync/try', { provider: 'openai', model: 'gpt-5' }), tryRes)
  assert.equal(tryRes.status, 200)
  assert.deepEqual(tryCalledWith, { provider: 'openai', model: 'gpt-5' })

  // POST /dsh-model-sync/notifications/read
  const readRes = createMockRes()
  await routes.get('/dsh-model-sync/notifications/read')(makeReq('POST', '/dsh-model-sync/notifications/read', { id: 'n-1' }), readRes)
  assert.equal(readRes.status, 200)
  assert.deepEqual(noticeActionCalled, { id: 'n-1', action: 'read' })

  // Method not allowed checks
  const badMethodRes = createMockRes()
  await routes.get('/dsh-model-sync/history')(makeReq('POST', '/dsh-model-sync/history'), badMethodRes)
  assert.equal(badMethodRes.status, 405)
})
