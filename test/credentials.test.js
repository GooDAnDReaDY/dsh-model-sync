import test from 'node:test'
import assert from 'node:assert/strict'
import { createCredentialResolver, normalizeApiKey } from '../lib/credentials.js'

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
