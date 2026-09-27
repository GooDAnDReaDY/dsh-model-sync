import test from 'node:test'
import assert from 'node:assert/strict'
import { lookupReferencePricing } from '../lib/pricing-database.js'

test('lookupReferencePricing returns accurate pricing for standard OpenAI models', () => {
  const gpt4o = lookupReferencePricing('openai', 'gpt-4o')
  assert.ok(gpt4o)
  assert.equal(gpt4o.inputPerToken, 0.0000025)
  assert.equal(gpt4o.outputPerToken, 0.000010)
  assert.equal(gpt4o.source, 'reference')

  const mini = lookupReferencePricing('openai', 'gpt-4o-mini')
  assert.ok(mini)
  assert.equal(mini.inputPerToken, 0.00000015)
  assert.equal(mini.outputPerToken, 0.0000006)
})

test('lookupReferencePricing handles date suffixes and version tags', () => {
  const sonnetDated = lookupReferencePricing('anthropic', 'claude-3-5-sonnet-20241022')
  assert.ok(sonnetDated)
  assert.equal(sonnetDated.inputPerToken, 0.000003)
  assert.equal(sonnetDated.outputPerToken, 0.000015)

  const gptDated = lookupReferencePricing('openai', 'gpt-4o-2024-11-20')
  assert.ok(gptDated)
  assert.equal(gptDated.inputPerToken, 0.0000025)
})

test('lookupReferencePricing works for Groq, Mistral, xAI and DeepSeek', () => {
  const groq = lookupReferencePricing('groq', 'llama-3.3-70b-versatile')
  assert.ok(groq)
  assert.equal(groq.inputPerToken, 0.00000059)
  assert.equal(groq.outputPerToken, 0.00000079)

  const mistral = lookupReferencePricing('mistral', 'codestral-latest')
  assert.ok(mistral)
  assert.equal(mistral.inputPerToken, 0.0000003)

  const xai = lookupReferencePricing('xai', 'grok-2')
  assert.ok(xai)
  assert.equal(xai.inputPerToken, 0.000002)

  const ds = lookupReferencePricing('deepseek', 'deepseek-chat')
  assert.ok(ds)
  assert.equal(ds.inputPerToken, 0.00000014)
  assert.equal(ds.cacheReadPerToken, 0.000000014)
})

test('lookupReferencePricing handles vendor prefixes for aggregator providers', () => {
  const routerClaude = lookupReferencePricing('openrouter', 'anthropic/claude-3-5-sonnet')
  assert.ok(routerClaude)
  assert.equal(routerClaude.inputPerToken, 0.000003)
})

test('lookupReferencePricing returns undefined for unknown models', () => {
  assert.equal(lookupReferencePricing('custom', 'completely-unknown-custom-model-999'), undefined)
})
