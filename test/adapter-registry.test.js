import test from 'node:test'
import assert from 'node:assert/strict'
import { createProviderAdapterRegistry } from '../lib/adapter-registry.js'

test('selects generic adapter for configured OpenAI-compatible routes', () => {
  const registry = createProviderAdapterRegistry({ resolveCredential: async () => 'key' })
  assert.equal(registry.select({
    provider: 'custom',
    api: 'openai-completions',
    baseURL: 'https://example.test/v1',
  }).id, 'openai-compatible')
})

test('selects Anthropic adapter and uses x-api-key auth', async () => {
  const calls = []
  const registry = createProviderAdapterRegistry({
    resolveCredential: async (ref) => {
      assert.equal(ref, 'ANTHROPIC_API_KEY')
      return 'secret'
    },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options })
      return new Response(JSON.stringify({ data: [{ id: 'claude-demo', display_name: 'Claude Demo' }] }), { status: 200 })
    },
  })
  const adapter = registry.select({ provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' })
  const rows = await adapter.discover({ provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' })
  assert.equal(rows[0].id, 'claude-demo')
  assert.equal(calls[0].options.headers['x-api-key'], 'secret')
  assert.equal(calls[0].options.headers.Authorization, undefined)
})

test('selects Google adapter and keeps the key out of headers', async () => {
  let seen
  const registry = createProviderAdapterRegistry({
    resolveCredential: async () => 'secret',
    fetchImpl: async (url, options) => {
      seen = { url: String(url), options }
      return new Response(JSON.stringify({ models: [{ name: 'models/gemini-demo', displayName: 'Gemini Demo' }] }), { status: 200 })
    },
  })
  const adapter = registry.select({ provider: 'google', apiKeyEnv: 'GEMINI_API_KEY' })
  const rows = await adapter.discover({ provider: 'google', apiKeyEnv: 'GEMINI_API_KEY' })
  assert.equal(rows[0].id, 'gemini-demo')
  assert.equal(new URL(seen.url).searchParams.get('key'), 'secret')
  assert.equal(seen.options.headers.Authorization, undefined)
})
