import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCredentialCheckRequest, normalizeCredentialRequest, normalizeHealthRequest, normalizeHistoryRequest, normalizeHistoryRollbackRequest, normalizeNotificationAction, normalizeNotificationRequest, normalizePolicyRequest, normalizeRunRequest, normalizeSelectionRequest, registerHttpApi } from '../lib/http.js'

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
