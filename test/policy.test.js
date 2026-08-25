import test from 'node:test'
import assert from 'node:assert/strict'
import { filterModels, hasPolicy, normalizePolicy, validatePolicy } from '../lib/policy.js'

const models = [
  { id: 'gpt-vision', name: 'GPT Vision', tags: ['featured'], capabilities: { vision: true, tools: true } },
  { id: 'gpt-text', name: 'GPT Text', tags: ['legacy'], capabilities: { vision: false, tools: true } },
  { id: 'embed-small', name: 'Embedding Small', tags: ['embedding'], capabilities: { embeddings: true } },
]

test('filters model ids, names, tags, and capabilities without inference', () => {
  const policy = validatePolicy({ include: ['gpt'], exclude: ['legacy'], requireCapabilities: { vision: true }, denyCapabilities: { tools: false } })
  assert.deepEqual(filterModels(models, policy).map((model) => model.id), ['gpt-vision'])
  assert.equal(hasPolicy(policy), true)
  assert.deepEqual(filterModels(models, { include: ['featured'] }).map((model) => model.id), ['gpt-vision'])
  assert.deepEqual(filterModels(models, { requireCapabilities: { vision: true } }).map((model) => model.id), ['gpt-vision'])
})

test('normalizes malformed policy fields to safe empty values', () => {
  assert.deepEqual(normalizePolicy({ include: [' a ', 'a', 7], requireCapabilities: { vision: true, unknown: true } }), {
    include: ['a'], exclude: [], requireCapabilities: { vision: true }, denyCapabilities: {},
  })
})

test('rejects invalid and oversized patterns', () => {
  assert.throws(() => validatePolicy({ include: ['['] }), (error) => error.code === 'INVALID_POLICY')
  assert.throws(() => validatePolicy({ exclude: ['x'.repeat(257)] }), (error) => error.code === 'INVALID_POLICY')
})
