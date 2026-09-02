import test from 'node:test'
import assert from 'node:assert/strict'
import { diffModels, normalizeModel, normalizeModels } from '../lib/models.js'

test('normalizes provider model metadata aliases', () => {
  assert.deepEqual(normalizeModel('demo', {
    id: 'demo-1',
    display_name: 'Demo 1',
    context_window: 32768,
    max_output_tokens: 4096,
    capabilities: ['vision', 'tools', 'reasoning'],
    pricing: { input_per_token: '0.00001', output_per_token: 0.00003, currency: 'USD', unit: 'per_token' },
  }), {
    provider: 'demo',
    id: 'demo-1',
    name: 'Demo 1',
    contextWindow: 32768,
    maxTokens: 4096,
    capabilities: { vision: true, tools: true, reasoning: true },
    pricing: { inputPerToken: 0.00001, outputPerToken: 0.00003, currency: 'USD', unit: 'per_token' },
  })
})

test('keeps explicit false capabilities and does not guess unknown values', () => {
  assert.deepEqual(normalizeModel('demo', {
    id: 'demo-2',
    capabilities: { vision: false, tools: true },
    description: 'No pricing or capability inference.',
  }), {
    provider: 'demo',
    id: 'demo-2',
    name: 'demo-2',
    description: 'No pricing or capability inference.',
    capabilities: { vision: false, tools: true },
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

test('reports explicit renames and keeps diff order stable', () => {
  const result = diffModels([{ id: 'z', name: 'Z' }, { id: 'old', name: 'Old' }], [
    { id: 'new', name: 'New', previousIds: ['old'] },
    { id: 'a', name: 'A' },
  ])
  assert.deepEqual(result.added.map((row) => row.id), ['a'])
  assert.equal(result.renamed[0].before.id, 'old')
  assert.equal(result.renamed[0].after.id, 'new')
  assert.deepEqual(result.removed.map((row) => row.id), ['z'])
})

test('diffModels is insensitive to key ordering in capabilities and pricing', () => {
  const before = [{
    id: 'm1',
    name: 'M1',
    capabilities: { vision: true, tools: true },
    pricing: { inputPerToken: 0.01, outputPerToken: 0.02 },
  }]
  const after = [{
    id: 'm1',
    name: 'M1',
    capabilities: { tools: true, vision: true },
    pricing: { outputPerToken: 0.02, inputPerToken: 0.01 },
  }]
  const result = diffModels(before, after)
  assert.equal(result.hasChanges, false)
  assert.equal(result.changed.length, 0)
})
