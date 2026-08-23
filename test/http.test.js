import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRunRequest, registerHttpApi } from '../lib/http.js'

test('normalizes run requests to a safe dry-run default', () => {
  assert.deepEqual(normalizeRunRequest({}), { dryRun: true, removeMissing: false })
  assert.deepEqual(normalizeRunRequest({ provider: 'openai', dryRun: false, removeMissing: true }), { provider: 'openai', dryRun: false, removeMissing: true })
  assert.throws(() => normalizeRunRequest({ dryRun: 'false' }), /dryRun must be boolean/)
})

test('registers separate exact status and run endpoints', () => {
  const routes = []
  const ctx = { webServer: { register: (route) => { routes.push(route); return () => {} } } }
  const sync = { status: () => ({ running: false }), listProviders: () => [], run: async () => ({}) }
  const disposers = registerHttpApi(ctx, sync)
  assert.equal(routes.length, 2)
  assert.deepEqual(routes.map((route) => [route.kind, route.path]), [
    ['exact', '/dsh-model-sync/status'],
    ['exact', '/dsh-model-sync/run'],
  ])
  assert.equal(disposers.length, 2)
})
