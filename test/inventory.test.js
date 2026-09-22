import test from 'node:test'
import assert from 'node:assert/strict'
import { isApiKeyProvider, listApiKeyProviders } from '../lib/inventory.js'

test('recognizes built-in API-key providers without a configured route', () => {
  assert.equal(isApiKeyProvider({ provider: 'openai', declared: false }, {}), true)
  assert.equal(isApiKeyProvider({ provider: 'openai-codex', declared: false }, {}), false)
})

test('includes configured custom routes with apiKeyEnv', () => {
  const llm = {
    listConfigurableProviders: () => [
      { provider: 'custom-gateway', displayName: 'Custom Gateway', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'custom-gateway'], declared: true },
    ],
    listProviders: () => [{ id: 'custom-gateway', name: 'Custom Gateway' }],
  }
  const settings = { get: () => ({ providers: { 'custom-gateway': { apiKeyEnv: 'CUSTOM_API_KEY', models: [{ id: 'demo' }] } } }) }
  const [row] = listApiKeyProviders(llm, settings)
  assert.equal(row.provider, 'custom-gateway')
  assert.equal(row.configured, true)
  assert.equal(row.live, true)
  assert.equal(row.apiKeyEnv, 'CUSTOM_API_KEY')
  assert.equal(row.credentialRef, 'CUSTOM_API_KEY')
})

test('includes configured custom routes with credentialRef or apiKeyRef', () => {
  const llm = {
    listConfigurableProviders: () => [
      { provider: 'modern-provider', displayName: 'Modern Provider', declared: true },
      { provider: 'legacy-provider', displayName: 'Legacy Provider', declared: true },
    ],
    listProviders: () => [{ id: 'modern-provider' }, { id: 'legacy-provider' }],
  }
  const settings = {
    get: () => ({
      providers: {
        'modern-provider': { credentialRef: 'DSH_CRED_KEY', models: [{ id: 'm1' }] },
        'legacy-provider': { apiKeyRef: 'LEGACY_KEY_REF', models: [{ id: 'l1' }] },
      },
    }),
  }
  const rows = listApiKeyProviders(llm, settings)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].apiKeyEnv, 'DSH_CRED_KEY')
  assert.equal(rows[0].credentialRef, 'DSH_CRED_KEY')
  assert.equal(rows[1].apiKeyEnv, 'LEGACY_KEY_REF')
  assert.equal(rows[1].credentialRef, 'LEGACY_KEY_REF')
})
