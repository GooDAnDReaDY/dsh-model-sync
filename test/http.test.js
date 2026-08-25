import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeHealthRequest, normalizePolicyRequest, normalizeRunRequest, normalizeSelectionRequest, registerHttpApi } from '../lib/http.js'

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

test('normalizes model selection requests and deduplicates ids', () => {
  assert.deepEqual(normalizeSelectionRequest({ provider: 'openai', models: ['a', ' a ', 'b'] }), { provider: 'openai', models: ['a', 'b'] })
  assert.throws(() => normalizeSelectionRequest({ provider: 'openai', models: 'a' }), /models must be an array/)
})

test('registers separate exact status and run endpoints', () => {
  const routes = []
  const ctx = { webServer: { register: (route) => { routes.push(route); return () => {} } } }
  const sync = { status: () => ({ running: false }), listProviders: () => [], run: async () => ({}), health: async () => ({ results: [] }), setModelSelection: async () => ({}), setModelPolicy: async () => ({}) }
  const disposers = registerHttpApi(ctx, sync)
  assert.equal(routes.length, 5)
  assert.deepEqual(routes.map((route) => [route.kind, route.path]), [
    ['exact', '/dsh-model-sync/status'],
    ['exact', '/dsh-model-sync/run'],
    ['exact', '/dsh-model-sync/health'],
    ['exact', '/dsh-model-sync/selection'],
    ['exact', '/dsh-model-sync/policy'],
  ])
  assert.equal(disposers.length, 5)
})
