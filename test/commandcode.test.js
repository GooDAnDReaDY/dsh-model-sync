import test from 'node:test'
import assert from 'node:assert/strict'
import { createProviderAdapterRegistry } from '../lib/adapter-registry.js'
import { listApiKeyProviders } from '../lib/inventory.js'
import { createModelSynchronizer } from '../lib/synchronizer.js'

test('commandcode: adapter selects and discovers models from Command Code API', async () => {
  const samplePayload = {
    data: [
      {
        id: 'deepseek/deepseek-v4.1-flash',
        object: 'model',
        created: 1789914126,
        name: 'DeepSeek V4.1 Flash',
        context_length: 1048576,
        supported_endpoints: ['/chat/completions', '/responses'],
      },
      {
        id: 'google/gemini-3.8-flash',
        object: 'model',
        created: 1789914126,
        name: 'Gemini 3.8 Flash',
        context_length: 1000000,
        supported_endpoints: ['/chat/completions'],
      },
    ],
  }

  let capturedUrl
  let capturedHeaders
  const registry = createProviderAdapterRegistry({
    resolveCredential: async (ref) => {
      assert.equal(ref, 'COMMANDCODE_API_KEY')
      return 'cmd-secret-key'
    },
    fetchImpl: async (url, options) => {
      capturedUrl = String(url)
      capturedHeaders = options?.headers
      return new Response(JSON.stringify(samplePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  const adapter = registry.select({ provider: 'commandcode', apiKeyEnv: 'COMMANDCODE_API_KEY' })
  assert.ok(adapter, 'Command Code adapter must be selected')

  const rows = await adapter.discover({ provider: 'commandcode', apiKeyEnv: 'COMMANDCODE_API_KEY' })
  assert.equal(capturedUrl, 'https://api.commandcode.ai/provider/v1/models')
  assert.equal(capturedHeaders.Authorization, 'Bearer cmd-secret-key')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].id, 'deepseek/deepseek-v4.1-flash')
  assert.equal(rows[0].name, 'DeepSeek V4.1 Flash')
  assert.equal(rows[0].contextWindow, 1048576)
  assert.equal(rows[1].id, 'google/gemini-3.8-flash')
  assert.equal(rows[1].contextWindow, 1000000)
})

test('commandcode: listApiKeyProviders recognizes commandcode from configurable providers', () => {
  const fakeLlm = {
    listConfigurableProviders: () => [
      { provider: 'commandcode', displayName: 'Command Code', settingsNs: 'llm-commandcode', declared: false },
    ],
    listProviders: () => [],
  }
  const fakeSettings = {
    get: (ns) => {
      if (ns === 'llm-commandcode') return { apiKeyEnv: 'COMMANDCODE_API_KEY', visibleModels: ['model-1'] }
      return {}
    },
  }

  const providers = listApiKeyProviders(fakeLlm, fakeSettings)
  assert.equal(providers.length, 1)
  assert.equal(providers[0].provider, 'commandcode')
  assert.equal(providers[0].apiKeyEnv, 'COMMANDCODE_API_KEY')
  assert.equal(providers[0].baseURL, 'https://api.commandcode.ai')
})

test('commandcode: setModelSelection persists in config and mutates llm-commandcode.visibleModels', async () => {
  let storedConfig = { modelSelections: {} }
  let mutatedSection = null
  let mutatedOps = null

  const mockCtx = {
    llm: {
      listConfigurableProviders: () => [
        { provider: 'commandcode', displayName: 'Command Code', settingsNs: 'llm-commandcode', declared: false },
      ],
      listProviders: () => [],
    },
    get: (ns) => {
      if (ns === 'llm-commandcode') return { apiKeyEnv: 'COMMANDCODE_API_KEY', visibleModels: [] }
      if (ns === 'settings') {
        return {
          get: (s) => (s === 'llm-commandcode' ? { apiKeyEnv: 'COMMANDCODE_API_KEY', visibleModels: [] } : {}),
          mutate: async (s, ops) => {
            mutatedSection = s
            mutatedOps = ops
          },
        }
      }
      return undefined
    },
  }

  const synchronizer = createModelSynchronizer(mockCtx, {
    getConfig: () => storedConfig,
    saveConfig: async (patch) => {
      storedConfig = { ...storedConfig, ...patch }
    },
    adapterImplementations: {
      commandcode: {
        discover: async () => [
          { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' },
          { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
        ],
      },
    },
  })

  // Pre-seed catalog cache
  storedConfig.modelCatalogs = {
    commandcode: [
      { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' },
      { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    ],
  }

  const res = await synchronizer.setModelSelection('commandcode', ['deepseek/deepseek-v4.1-flash'])
  assert.equal(res.applied, true)
  assert.deepEqual(storedConfig.modelSelections.commandcode, ['deepseek/deepseek-v4.1-flash'])
  assert.equal(mutatedSection, 'llm-commandcode')
  assert.deepEqual(mutatedOps, [{ op: 'set', path: ['visibleModels'], value: ['deepseek/deepseek-v4.1-flash'] }])
})
