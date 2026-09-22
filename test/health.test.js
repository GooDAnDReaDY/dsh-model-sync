import test from 'node:test'
import assert from 'node:assert/strict'
import { createProviderAdapterRegistry } from '../lib/adapter-registry.js'

function okResponse() {
  return { ok: true, status: 200, body: { cancel: async () => {} }, text: async () => JSON.stringify({ data: [] }) }
}

test('generic health probe checks status without parsing a catalog', async () => {
  let bodyCancelled = false
  const registry = createProviderAdapterRegistry({
    resolveCredential: async () => 'secret',
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer secret')
      return { ...okResponse(), body: { cancel: async () => { bodyCancelled = true } } }
    },
  })
  const result = await registry.select({ provider: 'custom', api: 'openai-completions', baseURL: 'https://example.test/v1', apiKeyEnv: 'KEY' }).health({
    provider: 'custom', api: 'openai-completions', baseURL: 'https://example.test/v1', apiKeyEnv: 'KEY',
  })
  assert.equal(result.statusCode, 200)
  assert.equal(bodyCancelled, true)
})

test('provider-specific health probe surfaces HTTP status', async () => {
  const registry = createProviderAdapterRegistry({
    resolveCredential: async () => 'secret',
    fetchImpl: async () => ({ ok: false, status: 401, body: { cancel: async () => {} } }),
  })
  await assert.rejects(() => registry.select({ provider: 'anthropic', apiKeyEnv: 'KEY' }).health({ provider: 'anthropic', apiKeyEnv: 'KEY' }), (error) => {
    assert.equal(error.status, 401)
    return true
  })
})
