import test from 'node:test'
import assert from 'node:assert/strict'
import { canUseGenericAdapter, discoverOpenAIModels } from '../lib/generic-adapter.js'

test('discovers OpenAI-compatible model rows with bearer credential', async () => {
  const calls = []
  const rows = await discoverOpenAIModels({
    provider: 'demo',
    api: 'openai-completions',
    baseURL: 'https://example.test/v1/',
    apiKeyEnv: 'DEMO_API_KEY',
  }, {
    resolveCredential: async (ref) => {
      assert.equal(ref, 'DEMO_API_KEY')
      return 'secret-value'
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ data: [
        { id: 'demo-1', name: 'Demo One', context_length: 8192 },
        { id: 'demo-1', name: 'duplicate' },
      ] }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.deepEqual(rows, [{
    provider: 'demo',
    id: 'demo-1',
    name: 'Demo One',
    contextWindow: 8192,
  }])
  assert.equal(calls[0].url, 'https://example.test/v1/models')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-value')
})

test('rejects unsupported protocol before network access', async () => {
  await assert.rejects(() => discoverOpenAIModels({
    provider: 'demo',
    api: 'anthropic-messages',
    baseURL: 'https://example.test',
  }, { fetchImpl: async () => { throw new Error('must not call') } }))
})
