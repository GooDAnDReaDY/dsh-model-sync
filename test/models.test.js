import test from 'node:test'
import assert from 'node:assert/strict'
import { diffModels, normalizeModel, normalizeModels } from '../lib/models.js'

test('normalizes provider model metadata aliases', () => {
  assert.deepEqual(normalizeModel('demo', {
    id: 'demo-1',
    display_name: 'Demo 1',
    context_window: 32768,
    max_output_tokens: 4096,
  }), {
    provider: 'demo',
    id: 'demo-1',
    name: 'Demo 1',
    contextWindow: 32768,
    maxTokens: 4096,
  })
})

test('deduplicates model ids while keeping first entry', () => {
  assert.deepEqual(normalizeModels('demo', ['a', { id: 'a', name: 'A' }, 'b']).map((row) => row.id), ['a', 'b'])
})

test('reports additions, removals, and metadata changes', () => {
  const result = diffModels([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], [
    { id: 'a', name: 'A2' },
    { id: 'c', name: 'C' },
  ])
  assert.equal(result.added[0].id, 'c')
  assert.equal(result.removed[0].id, 'b')
  assert.equal(result.changed[0].after.name, 'A2')
  assert.equal(result.hasChanges, true)
})
