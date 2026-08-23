import test from 'node:test'
import assert from 'node:assert/strict'
import { createProviderService } from '../lib/provider-service.js'

test('provider service reads the current DSH directory on every call', () => {
  let configured = false
  const ctx = {
    llm: {
      listConfigurableProviders: () => [{
        provider: 'demo',
        displayName: 'Demo',
        settingsNs: 'llm-pi-ai',
        settingsPath: ['providers', 'demo'],
        declared: true,
      }],
      listProviders: () => configured ? [{ id: 'demo', name: 'Demo' }] : [],
    },
    get: () => ({
      get: () => ({
        providers: configured ? { demo: { apiKeyEnv: 'DEMO_API_KEY' } } : {},
      }),
    }),
  }
  const service = createProviderService(ctx)
  assert.equal(service.listProviders()[0].live, false)
  configured = true
  assert.equal(service.getProvider('demo').live, true)
})
