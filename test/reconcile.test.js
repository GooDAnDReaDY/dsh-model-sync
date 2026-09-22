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


test('reconcileModels merges capabilities, compat, and input preserving user overrides and settings', () => {
  const current = [{
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen/Qwen3.8-27B',
    contextWindow: 131042,
    input: [],
    compat: {
      chatTemplateKwargs: {},
      chatTemplateArgs: {},
    },
    provider: 'groq',
    capabilities: {
      vision: true,
    },
  }]

  const discovered = [{
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen/Qwen3.8-27B',
    context_window: 131042,
    input_modalities: ['text', 'image'],
    supported_features: ['tools', 'json_mode', 'reasoning'],
  }]

  const result = reconcileModels('groq', current, discovered)
  assert.equal(result.next.length, 1)
  const merged = result.next[0]
  assert.equal(merged.id, 'qwen/qwen3.8-27b')
  assert.deepEqual(merged.input, ['text', 'image'])
  assert.deepEqual(merged.capabilities, {
    vision: true,
    tools: true,
    reasoning: true,
  })
  assert.deepEqual(merged.compat, {
    supportsDeveloperRole: false,
    chatTemplateKwargs: {},
    chatTemplateArgs: {},
  })
})

test('reconcileModels preserves user overrides for compat and capabilities', () => {
  const current = [{
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen/Qwen3.8-27B',
    provider: 'groq',
    compat: {
      supportsDeveloperRole: true,
      chatTemplateKwargs: { custom: 'value' },
    },
    capabilities: {
      vision: true,
      tools: false,
    },
  }]

  const discovered = [{
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen/Qwen3.8-27B',
    input_modalities: ['text', 'image'],
    supported_features: ['tools', 'reasoning'],
  }]

  const result = reconcileModels('groq', current, discovered)
  const merged = result.next[0]
  assert.equal(merged.compat.supportsDeveloperRole, true, 'Explicit user override for supportsDeveloperRole preserved')
  assert.equal(merged.compat.chatTemplateKwargs.custom, 'value')
  assert.equal(merged.capabilities.tools, false, 'Explicit user override for tools: false preserved')
  assert.equal(merged.capabilities.reasoning, true, 'Discovered reasoning capability added')
})
