import test from 'node:test'
import assert from 'node:assert/strict'
import { createModelSynchronizer } from '../lib/synchronizer.js'
import { catalogRequestError } from '../lib/reliability.js'

function response(payload) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) }
}

function makeContext(providerIds = ['demo']) {
  const section = {
    providers: Object.fromEntries(providerIds.map((provider) => [provider, {
      apiKeyEnv: `${provider.toUpperCase()}_KEY`,
      baseURL: `https://${provider}.test/v1`,
      api: 'openai-completions',
      models: [{ id: `${provider}-old`, name: 'Old' }],
    }])),
  }
  const settings = {
    get: () => section,
    describe: () => [{ ns: 'llm-pi-ai', revision: 7, value: section }],
    replace: async (_ns, next) => { section.providers = next.providers },
  }
  const ctx = {
    llm: {
      listConfigurableProviders: () => providerIds.map((provider) => ({ provider, displayName: provider, declared: true })),
      listProviders: () => providerIds.map((id) => ({ id, name: id })),
    },
    get: (key) => key === 'settings' ? settings : key === 'credentials' ? { resolve: async (ref) => ({ value: ref + '-value' }) } : undefined,
  }
  return { ctx, section }
}

test('retries a transient provider failure and reports retry count', async () => {
  const { ctx } = makeContext()
  let calls = 0
  const sync = createModelSynchronizer(ctx, {
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) throw catalogRequestError(503)
      return response({ data: [{ id: 'demo-new', name: 'New' }] })
    },
  })
  const result = await sync.run({ dryRun: true, retryAttempts: 2, retryBaseDelayMs: 0, retryMaxDelayMs: 0 })
  assert.equal(calls, 2)
  assert.equal(result.results[0].status, 'ok')
  assert.equal(result.results[0].retries, 1)
})

test('does not retry a permanent credential failure', async () => {
  const { ctx } = makeContext()
  let calls = 0
  const sync = createModelSynchronizer(ctx, {
    fetchImpl: async () => { calls += 1; throw catalogRequestError(401) },
  })
  const result = await sync.run({ dryRun: true, retryAttempts: 4, retryBaseDelayMs: 0 })
  assert.equal(calls, 1)
  assert.equal(result.results[0].status, 'error')
  assert.equal(result.results[0].retryable, false)
})

test('opens a per-provider circuit after repeated transient failures', async () => {
  const { ctx } = makeContext()
  let calls = 0
  const sync = createModelSynchronizer(ctx, {
    fetchImpl: async () => { calls += 1; throw catalogRequestError(503) },
  })
  const options = { dryRun: true, retryAttempts: 1, circuitBreakerFailures: 2, circuitBreakerCooldownMs: 60000 }
  await sync.run(options)
  await sync.run(options)
  const blocked = await sync.run(options)
  assert.equal(calls, 2)
  assert.equal(blocked.results[0].status, 'circuit-open')
})

test('runs health probes separately without changing model catalogs', async () => {
  const { ctx, section } = makeContext()
  const before = structuredClone(section.providers)
  const sync = createModelSynchronizer(ctx, {
    fetchImpl: async () => response({ data: [{ id: 'ignored-by-health', name: 'Ignored' }] }),
  })
  const result = await sync.health({ concurrency: 1, retryAttempts: 1 })
  assert.equal(result.results[0].status, 'ok')
  assert.equal(result.results[0].statusCode, 200)
  assert.deepEqual(section.providers, before)
  assert.deepEqual(sync.status().lastHealth.results.map((row) => row.provider), ['demo'])
})

test('limits provider discovery concurrency', async () => {
  const { ctx } = makeContext(['one', 'two', 'three'])
  let active = 0
  let maximum = 0
  const sync = createModelSynchronizer(ctx, {
    fetchImpl: async (url) => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      const provider = new URL(url).hostname.split('.')[0]
      return response({ data: [{ id: `${provider}-new`, name: 'New' }] })
    },
  })
  const result = await sync.run({ dryRun: true, concurrency: 2, retryAttempts: 1 })
  assert.equal(maximum, 2)
  assert.deepEqual(result.results.map((row) => row.status), ['ok', 'ok', 'ok'])
})


test('persists provider policy and applies only policy-approved models', async () => {
  const { ctx, section } = makeContext()
  const config = { modelPolicies: {}, modelCatalogs: {} }
  const saves = []
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => { saves.push(patch); Object.assign(config, patch) },
    fetchImpl: async () => response({ data: [
      { id: 'demo-old', name: 'Old', tags: ['legacy'] },
      { id: 'demo-new', name: 'New', tags: ['featured'], capabilities: { vision: true } },
    ] }),
  })
  const saved = await sync.setModelPolicy('demo', { include: ['featured'] })
  assert.deepEqual(saved.policy.include, ['featured'])
  assert.deepEqual(section.providers.demo.models.map((model) => model.id), ['demo-old'])

  const preview = await sync.run({ dryRun: true, retryAttempts: 1 })
  assert.deepEqual(preview.results[0].availableModels.map((model) => model.id), ['demo-new'])
  assert.deepEqual(preview.results[0].advertised.map((model) => model.id), ['demo-new'])
  assert.deepEqual(section.providers.demo.models.map((model) => model.id), ['demo-old'])

  const applied = await sync.run({ dryRun: false, retryAttempts: 1 })
  assert.equal(applied.applied, true)
  assert.deepEqual(section.providers.demo.models.map((model) => model.id), ['demo-new'])
  assert.deepEqual(config.modelCatalogs.demo.map((model) => model.id), ['demo-old', 'demo-new'])
  assert.equal(saves.some((patch) => patch.modelPolicies), true)
})
