import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAlias, validateAliasName, isVirtualAlias } from '../lib/alias-resolver.js'

test('validateAliasName validates standard and virtual alias names', () => {
  assert.equal(validateAliasName('gpt-4o'), true)
  assert.equal(validateAliasName('@fast'), true)
  assert.equal(validateAliasName('@cheap'), true)
  assert.equal(validateAliasName('@best-code'), true)
  assert.equal(validateAliasName('code_model.v1'), true)
  assert.equal(validateAliasName(''), false)
  assert.equal(validateAliasName('invalid space'), false)
  assert.equal(validateAliasName('invalid$char'), false)
})

test('isVirtualAlias detects virtual aliases', () => {
  assert.equal(isVirtualAlias('@fast'), true)
  assert.equal(isVirtualAlias('@cheap'), true)
  assert.equal(isVirtualAlias('@best-code'), true)
  assert.equal(isVirtualAlias('@custom'), false)
  assert.equal(isVirtualAlias('fast'), false)
  assert.equal(isVirtualAlias('@custom', 'fastest'), true)
})

test('resolveAlias with fallback chain auto-fallbacks on circuit-open or health-fail', () => {
  const aliases = {
    'primary-chain': {
      targets: [
        { provider: 'primary-prov', model: 'primary-model' },
        { provider: 'backup-prov', model: 'backup-model' },
      ],
    },
  }

  // 1. Primary is healthy
  const healthy = resolveAlias('primary-chain', { aliases })
  assert.equal(healthy.provider, 'primary-prov')
  assert.equal(healthy.model, 'primary-model')
  assert.equal(healthy.fallbackUsed, false)

  // 2. Primary circuit is open
  const fallback = resolveAlias('primary-chain', {
    aliases,
    isCircuitOpen: (p) => p === 'primary-prov',
  })
  assert.equal(fallback.provider, 'backup-prov')
  assert.equal(fallback.model, 'backup-model')
  assert.equal(fallback.fallbackUsed, true)
  assert.equal(fallback.skipped.length, 1)
  assert.equal(fallback.skipped[0].reason, 'circuit_open')

  // 3. Primary health probe failed
  const healthFallback = resolveAlias('primary-chain', {
    aliases,
    healthResults: [{ provider: 'primary-prov', status: 'error' }],
  })
  assert.equal(healthFallback.provider, 'backup-prov')
  assert.equal(healthFallback.fallbackUsed, true)
})

test('resolveAlias resolves @fast to the lowest latency healthy model', () => {
  const modelCatalogs = {
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
    ],
  }
  const modelProbes = {
    'groq:llama-3.3-70b-versatile': { latencyMs: 140 },
    'openai:gpt-4o': { latencyMs: 520 },
  }

  const res = resolveAlias('@fast', { modelCatalogs, modelProbes })
  assert.equal(res.provider, 'groq')
  assert.equal(res.model, 'llama-3.3-70b-versatile')
  assert.equal(res.latencyMs, 140)

  // If groq circuit opens, fallback to next fastest
  const resFallback = resolveAlias('@fast', {
    modelCatalogs,
    modelProbes,
    isCircuitOpen: (p) => p === 'groq',
  })
  assert.equal(resFallback.provider, 'openai')
  assert.equal(resFallback.model, 'gpt-4o')
})

test('resolveAlias resolves @cheap to the lowest pricing model', () => {
  const modelCatalogs = {
    openrouter: [
      { id: 'expensive', name: 'Expensive', pricing: { inputPerToken: 0.00003, outputPerToken: 0.00006 } },
      { id: 'cheap-model', name: 'Cheap Model', pricing: { inputPerToken: 0.0000001, outputPerToken: 0.0000002 } },
    ],
  }

  const res = resolveAlias('@cheap', { modelCatalogs })
  assert.equal(res.provider, 'openrouter')
  assert.equal(res.model, 'cheap-model')
})

test('resolveAlias resolves @best-code prioritizing coding and reasoning models', () => {
  const modelCatalogs = {
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', capabilities: { code: true, reasoning: true }, contextWindow: 200000 },
    ],
    openai: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', capabilities: { code: true } },
    ],
  }

  const res = resolveAlias('@best-code', { modelCatalogs })
  assert.equal(res.provider, 'anthropic')
  assert.equal(res.model, 'claude-3-5-sonnet-20241022')
})

test('resolveAlias rejects unsupported custom strategy with INVALID_STRATEGY', () => {
  const aliases = {
    broken: { strategy: 'magic' },
  }
  assert.throws(
    () => resolveAlias('broken', { aliases }),
    (err) => err.code === 'INVALID_STRATEGY'
  )
})
