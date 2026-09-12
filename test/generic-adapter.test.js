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

test('resolves credential via credentialRef when apiKeyEnv is missing', async () => {
  const calls = []
  await discoverOpenAIModels({
    provider: 'demo',
    api: 'openai-completions',
    baseURL: 'https://example.test/v1',
    credentialRef: 'CRED_REF_KEY',
  }, {
    resolveCredential: async (ref) => {
      assert.equal(ref, 'CRED_REF_KEY')
      return 'resolved-token'
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ data: [{ id: 'm1' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(calls[0].options.headers.Authorization, 'Bearer resolved-token')
})


test('discoverOpenAIModels passes etag and handles 304 not modified', async () => {
  let passedHeaders = null
  const fakeFetch = async (url, options) => {
    passedHeaders = options.headers
    return {
      status: 304,
      ok: false,
      headers: new Headers({ etag: '"up-123"' }),
    }
  }

  const profile = { provider: 'custom-ai', baseURL: 'https://api.example.com/v1', api: 'openai-completions' }
  const result = await discoverOpenAIModels(profile, {
    resolveCredential: async () => 'test-key',
    fetchImpl: fakeFetch,
    etag: '"up-123"',
    lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT',
  })

  assert.equal(passedHeaders['If-None-Match'], '"up-123"')
  assert.equal(passedHeaders['If-Modified-Since'], 'Mon, 01 Jan 2026 00:00:00 GMT')
  assert.equal(result.notModified, true)
  assert.equal(result.etag, '"up-123"')
})
