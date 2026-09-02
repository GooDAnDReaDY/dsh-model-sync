import test from 'node:test'
import assert from 'node:assert/strict'
import { createModelSynchronizer } from '../lib/synchronizer.js'

test('synchronizer run retries on settings conflict and succeeds', async () => {
  let revision = 1
  let replaceAttempts = 0
  const section = {
    providers: {
      demo: {
        adapterId: 'demo',
        apiKeyEnv: 'DEMO_KEY',
        models: [{ id: 'old-m', name: 'Old M' }],
      },
    },
  }

  const settings = {
    get: () => section,
    describe: () => [{ ns: 'llm-pi-ai', revision }],
    replace: async (ns, next, rev) => {
      replaceAttempts++
      if (replaceAttempts === 1) {
        // Simulate concurrent modification bump
        revision = 2
        const err = new Error('Settings conflict')
        err.code = 'SETTINGS_CONFLICT'
        throw err
      }
      assert.equal(rev, 2)
      section.providers = next.providers
    },
  }

  const ctx = {
    llm: {
      listConfigurableProviders: () => [{ provider: 'demo', displayName: 'Demo', declared: true }],
      listProviders: () => [{ id: 'demo' }],
    },
    get: (key) => key === 'settings' ? settings : key === 'credentials' ? { resolve: async () => ({ value: 'test-key' }) } : undefined,
  }

  const sync = createModelSynchronizer(ctx, {
    adapterImplementations: {
      demo: {
        discover: async () => [{ id: 'new-m', name: 'New M' }],
        health: async () => ({ statusCode: 200 }),
      },
    },
    saveConfig: async () => {},
  })

  const result = await sync.run({ dryRun: false })
  assert.equal(result.applied, true)
  assert.equal(replaceAttempts, 2)
  assert.equal(section.providers.demo.models.some((m) => m.id === 'new-m'), true)
})
