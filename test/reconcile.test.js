import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogPatch, reconcileModels } from '../lib/reconcile.js'

test('adds new models and updates metadata', () => {
  const result = reconcileModels('demo', [{ id: 'a', name: 'Old' }], [
    { id: 'a', name: 'New' },
    { id: 'b', name: 'Added' },
  ])
  assert.deepEqual(result.next.map((row) => row.id), ['a', 'b'])
  assert.equal(result.next[0].name, 'New')
  assert.equal(result.diff.added[0].id, 'b')
  assert.equal(result.diff.changed[0].after.name, 'New')
})

test('keeps missing models unless explicit removal is requested', () => {
  const safe = reconcileModels('demo', [{ id: 'old', name: 'Old' }], [], { removeMissing: false })
  assert.equal(safe.next[0].id, 'old')
  assert.equal(safe.stale[0].id, 'old')
  const pruned = reconcileModels('demo', [{ id: 'old', name: 'Old' }], [], { removeMissing: true })
  assert.equal(pruned.next.length, 0)
  assert.equal(pruned.stale[0].id, 'old')
})

test('patches only the provider model catalog', () => {
  const next = catalogPatch({
    retryPolicy: { mode: 'normal' },
    providers: { demo: { apiKeyEnv: 'DEMO_API_KEY' } },
  }, 'demo', [{ id: 'new', name: 'New' }])
  assert.equal(next.retryPolicy.mode, 'normal')
  assert.equal(next.providers.demo.apiKeyEnv, 'DEMO_API_KEY')
  assert.equal(next.providers.demo.models[0].id, 'new')
})

test('removes only lifecycle-confirmed ids when requested', () => {
  const result = reconcileModels('demo', [{ id: 'old', name: 'Old' }, { id: 'keep', name: 'Keep' }], [], { removeIds: ['old'] })
  assert.deepEqual(result.next.map((row) => row.id), ['keep'])
  assert.deepEqual(result.stale.map((row) => row.id), ['old', 'keep'])
})
