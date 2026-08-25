import test from 'node:test'
import assert from 'node:assert/strict'
import { createCredentialResolver, maskCredentialRef, normalizeApiKey } from '../lib/credentials.js'

test('trims printable API keys', () => {
  assert.equal(normalizeApiKey('  key-value  '), 'key-value')
  assert.equal(normalizeApiKey(undefined), '')
})

test('rejects non-printable API key values without exposing the value', () => {
  assert.throws(() => normalizeApiKey('bad\nkey'), /cannot be sent/)
})

test('resolves values through DSH credentials service', async () => {
  const resolver = createCredentialResolver({
    get: (name) => name === 'credentials' ? {
      resolve: async (ref) => ({ ref, value: '  secret  ' }),
    } : undefined,
  })
  assert.equal(await resolver('DEMO_API_KEY'), 'secret')
})

test('describes credential refs without resolving or exposing values', async () => {
  let resolves = 0
  const resolver = createCredentialResolver({
    credentials: {
      describe: async () => ({ configured: true, source: 'file', writable: true }),
      resolve: async () => { resolves += 1; return { value: 'TOP-SECRET', source: 'file' } },
    },
  })
  const rows = await resolver.diagnostics(['DEMO_API_KEY', 'DEMO_API_KEY_2'])
  assert.equal(resolves, 0)
  assert.equal(rows[0].configured, true)
  assert.equal(rows[0].source, 'file')
  assert.equal(rows[0].label.includes('TOP-SECRET'), false)
  assert.equal(maskCredentialRef('DEMO_API_KEY'), 'DE…_KEY')
})

test('records safe resolution state and redacts credential-shaped errors', async () => {
  const resolver = createCredentialResolver({
    credentials: {
      describe: async () => ({ configured: true, source: 'env', writable: false }),
      resolve: async () => { throw Object.assign(new Error('apiKey=TOP-SECRET'), { code: 'AUTH' }) },
    },
  })
  await assert.rejects(() => resolver('DEMO_API_KEY'), /redacted/)
  const row = await resolver.describe('DEMO_API_KEY')
  assert.equal(row.lastResolution.status, 'error')
  assert.equal(row.lastResolution.message.includes('TOP-SECRET'), false)
  assert.equal(row.lastResolution.message.includes('[redacted]'), true)
})
