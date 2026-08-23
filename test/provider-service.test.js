import test from 'node:test'
import assert from 'node:assert/strict'
import { createProviderService } from '../lib/provider-service.js'

test('provider service reads the current DSH directory on every call', () => {
  let live = false
  const ctx = {
    llm: {
      listConfigurableProviders: () => [{
        provider: 'demo',
        displayName: 'Demo',
        settingsNs: 'llm-pi-ai',
        settingsPath: ['providers', 'demo'],
        declared: true,
      }],
      listProviders: () => live ? [{ id: 'demo', name: 'Demo' }] : [],
    },
    get: () => ({
      get: () => ({
        providers: { demo: { apiKeyEnv: 'DEMO_API_KEY' } },
      }),
    }),
  }
  const service = createProviderService(ctx)
  assert.equal(service.listProviders()[0].live, false)
  live = true
  assert.equal(service.getProvider('demo').live, true)
})
