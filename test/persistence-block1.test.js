import test from 'node:test'
import assert from 'node:assert/strict'
import { Config, apply } from '../lib/index.js'
import { createModelSynchronizer } from '../lib/synchronizer.js'
import { discoverOpenAIModels } from '../lib/generic-adapter.js'
import { createProviderAdapterRegistry } from '../lib/adapter-registry.js'
import { createHistoryEntry } from '../lib/history.js'
import { performHistoryRollback } from '../lib/synchronizer-helpers.js'
import { normalizeModel, normalizeModels } from '../lib/models.js'

function makeMockContext(provider = 'demo', initialModels = [{ id: 'm1', name: 'Model 1' }]) {
  const section = {
    providers: {
      [provider]: {
        baseURL: 'https://api.example.com/v1',
        apiKeyEnv: 'DEMO_KEY',
        models: initialModels,
      },
    },
  }
  const settings = {
    get: (ns) => ns === 'llm-pi-ai' ? section : undefined,
    describe: () => [{ ns: 'llm-pi-ai', revision: 1, value: section }],
    replace: async (ns, next) => {
      if (ns === 'llm-pi-ai') section.providers = next.providers
    },
  }
  const ctx = {
    llm: {
      listConfigurableProviders: () => [{ provider, displayName: 'Demo', declared: true }],
      listProviders: () => [{ id: provider, name: 'Demo' }],
    },
    get: (key) => key === 'settings' ? settings : key === 'credentials' ? { resolve: async () => ({ value: 'test-key' }) } : undefined,
  }
  return { ctx, section, settings }
}

test('#186: all 8 settings fields declare .volatile() in Config schema', () => {
  const fields = [
    'notifications',
    'modelLifecycle',
    'history',
    'providers',
    'aliases',
    'adapterRegistry',
    'modelPolicies',
    'modelCatalogs',
  ]
  for (const field of fields) {
    const child = Config.dict[field]
    assert.ok(child, `${field} must exist in Config schema`)
    assert.ok(child.meta?.volatile, `${field} must be marked as volatile`)
  }
})

test('#227: saveConfig propagates write errors and does not update liveConfig', async () => {
  let settingsCallCount = 0
  const mockSettings = {
    update: async () => {
      settingsCallCount++
      throw new Error('disk full or write rejected')
    },
  }
  let capturedRunner = null
  const mockCtx = {
    effect(fn) { return fn() },
    provide(key, val) {
      if (key === 'modelSyncRunner') capturedRunner = val
    },
    on() {},
    get(key) { return key === 'settings' ? mockSettings : null },
    settings: mockSettings,
    logger: {
      warn() {},
      debug() {},
      info() {},
    },
  }

  apply(mockCtx, { enabled: true, aliases: {} })
  assert.ok(capturedRunner, 'modelSyncRunner should be registered')

  await assert.rejects(
    async () => {
      await capturedRunner.setAlias({
        alias: 'test-alias',
        provider: 'openai',
        model: 'gpt-4o',
      })
    },
    /disk full or write rejected/
  )
  assert.equal(settingsCallCount, 1)
  assert.equal(capturedRunner.status().aliases['test-alias'], undefined)
})

test('#227: saveConfig throws CONFIG_UNAVAILABLE when settings is not writable', async () => {
  let capturedRunner = null
  const mockCtx = {
    effect(fn) { return fn() },
    provide(key, val) {
      if (key === 'modelSyncRunner') capturedRunner = val
    },
    on() {},
    get() { return null },
    settings: null,
    logger: { warn() {}, debug() {}, info() {} },
  }

  apply(mockCtx, { enabled: true })
  await assert.rejects(
    async () => {
      await capturedRunner.setAlias({
        alias: 'test-alias',
        provider: 'openai',
        model: 'gpt-4o',
      })
    },
    (err) => err.code === 'CONFIG_UNAVAILABLE'
  )
})

test('#228: apply does not throw ReferenceError (TDZ) on invalid initial config', () => {
  const mockCtx = {
    effect(fn) { return fn() },
    provide() {},
    on() {},
    get() { return null },
    logger: { warn() {} },
  }
  // Passing intervalMinutes: "invalid-string" causes Config() validation to fail
  assert.doesNotThrow(() => {
    apply(mockCtx, { intervalMinutes: 'not-a-number' })
  })
})

test('#229: Apply removes policy-excluded models from active models while retaining full catalog', async () => {
  const { ctx, section } = makeMockContext('demo', [
    { id: 'old', name: 'Old Model' },
    { id: 'new', name: 'New Model' },
  ])
  const config = {
    modelPolicies: { demo: { exclude: ['old'] } },
    modelCatalogs: {},
  }

  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => Object.assign(config, patch),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [
        { id: 'old', name: 'Old Model' },
        { id: 'new', name: 'New Model' },
      ] }),
    }),
  })

  // Dry run preview: shows old is removed from advertised
  const preview = await sync.run({ dryRun: true })
  assert.equal(preview.results[0].provider, 'demo')
  assert.deepEqual(preview.results[0].advertised.map(m => m.id), ['new'])
  assert.deepEqual(section.providers.demo.models.map(m => m.id), ['old', 'new']) // untouched in dry-run

  // Apply run: active models in section become only ['new']
  const applied = await sync.run({ dryRun: false })
  assert.equal(applied.applied, true)
  assert.deepEqual(section.providers.demo.models.map(m => m.id), ['new'])
  // Catalog retains both old and new
  assert.deepEqual(config.modelCatalogs.demo.map(m => m.id), ['old', 'new'])
})

test('#230: HTTP 304 reuses in-memory body cache on repeated dry-runs before catalog persistence', async () => {
  let callCount = 0
  const fetchImpl = async (url, options) => {
    callCount++
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"etag-v1"' }),
        text: async () => JSON.stringify({ data: [
          { id: 'm1', name: 'Model 1' },
          { id: 'm2', name: 'Model 2' },
        ] }),
      }
    }
    // Second request with If-None-Match returns 304
    assert.equal(options.headers['If-None-Match'], '"etag-v1"')
    return {
      ok: false,
      status: 304,
      headers: new Headers({ etag: '"etag-v1"' }),
      text: async () => '',
    }
  }

  const { ctx } = makeMockContext('demo', [{ id: 'active-initial' }])
  const config = { modelCatalogs: {} } // Nothing persisted yet

  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async () => {}, // read-only during dry-run
    fetchImpl,
  })

  // First dry-run: discovers m1, m2
  const run1 = await sync.run({ dryRun: true })
  assert.deepEqual(run1.results[0].discoveredModels.map(m => m.id), ['m1', 'm2'])

  // Second dry-run: receives 304 Not Modified, must still return m1, m2 from in-memory cache!
  const run2 = await sync.run({ dryRun: true })
  assert.equal(run2.results[0].notModified, true)
  assert.deepEqual(run2.results[0].discoveredModels.map(m => m.id), ['m1', 'm2'])
})

test('#231: generic-adapter and adapter-registry throw schema error on HTTP 200 error payloads', async () => {
  // Generic adapter with error payload
  await assert.rejects(
    async () => {
      await discoverOpenAIModels({
        provider: 'demo',
        api: 'openai-completions',
        baseURL: 'https://example.test/v1',
      }, {
        resolveCredential: async () => 'key',
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ error: { message: 'upstream quota exceeded' } }),
        }),
      })
    },
    (err) => {
      assert.equal(err.adapterCode, 'schema')
      assert.match(err.message, /upstream quota exceeded/)
      return true
    }
  )

  // Generic adapter with non-array invalid payload
  await assert.rejects(
    async () => {
      await discoverOpenAIModels({
        provider: 'demo',
        api: 'openai-completions',
        baseURL: 'https://example.test/v1',
      }, {
        resolveCredential: async () => 'key',
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'ok', somethingElse: true }),
        }),
      })
    },
    (err) => err.adapterCode === 'schema'
  )

  // Adapter registry with error payload
  const registry = createProviderAdapterRegistry({
    resolveCredential: async () => 'key',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errors: [{ message: 'bad gateway payload' }] }),
    }),
  })
  const adapter = registry.select({ provider: 'openai' })
  await assert.rejects(
    async () => {
      await adapter.discover({ provider: 'openai' })
    },
    (err) => {
      assert.equal(err.adapterCode, 'schema')
      assert.match(err.message, /bad gateway payload/)
      return true
    }
  )
})

test('#232: history rollback preserves full model contract metadata including supportsDeveloperRole: false', async () => {
  const modelBefore = {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    input: ['text', 'image'],
    compat: { supportsDeveloperRole: false },
    tags: ['code', 'chat'],
    aliases: ['deepseek-v3'],
    lifecycle: { deprecated: false },
    capabilities: { reasoning: true },
    pricing: { inputPerToken: 0.000001, outputPerToken: 0.000002 },
    contextWindow: 64000,
    maxTokens: 4096,
  }

  const entry = createHistoryEntry({
    startedAt: 1000,
    finishedAt: 2000,
    results: [{
      provider: 'deepseek',
      status: 'ok',
      changed: true,
      before: [modelBefore],
      next: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
      diff: { added: [], removed: [], renamed: [], changed: [] },
    }],
  }, { version: 1 })

  const savedBefore = entry.providers[0].before[0]
  assert.deepEqual(savedBefore.input, ['text', 'image'])
  assert.deepEqual(savedBefore.compat, { supportsDeveloperRole: false })
  assert.deepEqual(savedBefore.tags, ['code', 'chat'])
  assert.deepEqual(savedBefore.aliases, ['deepseek-v3'])
  assert.deepEqual(savedBefore.lifecycle, { deprecated: false })

  // Rollback restores this snapshot into llm-pi-ai settings
  const { ctx, section } = makeMockContext('deepseek', [])

  const rollbackResult = await performHistoryRollback({
    ctx,
    config: { history: [entry] },
    providers: [{ provider: 'deepseek', configured: true }],
    historyId: entry.id,
    provider: 'deepseek',
  })

  assert.equal(rollbackResult.applied, true)
  const writtenModels = section.providers.deepseek.models
  assert.ok(writtenModels)
  const restored = writtenModels[0]
  assert.equal(restored.id, 'deepseek-chat')
  assert.deepEqual(restored.input, ['text', 'image'])
  assert.deepEqual(restored.compat, { supportsDeveloperRole: false })
  assert.deepEqual(restored.tags, ['code', 'chat'])
  assert.deepEqual(restored.aliases, ['deepseek-v3'])
  assert.deepEqual(restored.lifecycle, { deprecated: false })
})

test('#235: normalizePricing preserves pricing.source across repeated normalizations', () => {
  // Step 1: Initial normalization of OpenAI model gets reference pricing
  const model1 = normalizeModel('openai', { id: 'gpt-4o' })
  assert.ok(model1.pricing, 'pricing must exist')
  assert.equal(model1.pricing.source, 'reference')

  // Step 2: Second normalization (e.g. during reconciliation or diff)
  const model2 = normalizeModel('openai', model1)
  assert.ok(model2.pricing, 'pricing must still exist')
  assert.equal(model2.pricing.source, 'reference', 'pricing.source must be preserved')

  // Step 3: Array normalization
  const [model3] = normalizeModels('openai', [model2])
  assert.equal(model3.pricing.source, 'reference', 'pricing.source must survive normalizeModels')
})
