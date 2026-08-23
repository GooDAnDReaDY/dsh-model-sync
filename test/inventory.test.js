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
})
