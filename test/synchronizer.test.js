import test from 'node:test'
import assert from 'node:assert/strict'
import { createModelSynchronizer } from '../lib/synchronizer.js'

function makeContext() {
  const section = {
    providers: {
      demo: { apiKeyEnv: 'DEMO_KEY', baseURL: 'https://demo.test/v1', api: 'openai-completions', models: [{ id: 'old', name: 'Old' }], temperature: 0.2 },
    },
  }
  const settings = {
    get: () => section,
    describe: () => [{ ns: 'llm-pi-ai', revision: 7, value: section }],
    replace: async (_ns, next, revision) => {
      assert.equal(revision, 7)
      section.providers = next.providers
    },
  }
  const ctx = {
    llm: {
      listConfigurableProviders: () => [{ provider: 'demo', displayName: 'Demo', declared: true }],
      listProviders: () => [{ id: 'demo', name: 'Demo' }],
    },
    get: (key) => key === 'settings' ? settings : key === 'credentials' ? { resolve: async (ref) => ({ value: ref + '-value' }) } : undefined,
  }
  return { ctx, section, settings }
}

function response(payload) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) }
}

test('runs a dry discovery without writing settings', async () => {
  const { ctx, section } = makeContext()
  let calls = 0
  const sync = createModelSynchronizer(ctx, { fetchImpl: async () => { calls++; return response({ data: [{ id: 'new', name: 'New' }] }) } })
  const result = await sync.run({ provider: 'demo', dryRun: true })
  assert.equal(calls, 1)
  assert.equal(result.applied, false)
  assert.deepEqual(result.results[0].diff.added.map((row) => row.id), ['new'])
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old'])
})

test('applies only the reconciled model catalog and preserves provider settings', async () => {
  const { ctx, section } = makeContext()
  const sync = createModelSynchronizer(ctx, { fetchImpl: async () => response({ data: [{ id: 'new', name: 'New' }] }) })
  const result = await sync.run({ provider: 'demo', dryRun: false })
  assert.equal(result.applied, true)
  assert.equal(section.providers.demo.temperature, 0.2)
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old', 'new'])
})

test('coalesces concurrent runs into one discovery', async () => {
  const { ctx } = makeContext()
  let calls = 0
  const sync = createModelSynchronizer(ctx, { fetchImpl: async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 5)); return response({ data: [] }) } })
  const first = sync.run({ provider: 'demo' })
  const second = sync.run({ provider: 'demo' })
  assert.equal(await first, await second)
  assert.equal(calls, 1)
})


test('persists the full catalog after apply and restores it after restart', async () => {
  const { ctx, section } = makeContext()
  let config = { modelSelections: {}, modelCatalogs: {} }
  const saved = []
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => {
      saved.push(structuredClone(patch))
      config = { ...config, ...structuredClone(patch) }
    },
    fetchImpl: async () => response({ data: [{ id: 'old', name: 'Old' }, { id: 'new', name: 'New' }] }),
  })
  const result = await sync.run({ provider: 'demo', dryRun: false })
  assert.equal(result.catalogCachePersisted, true)
  assert.deepEqual(config.modelCatalogs.demo.map((row) => row.id), ['old', 'new'])
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old', 'new'])

  const restarted = createModelSynchronizer(ctx, { getConfig: () => config })
  assert.deepEqual(restarted.getProvider('demo').availableModels.map((row) => row.id), ['old', 'new'])
  assert.deepEqual(saved.at(-1).modelCatalogs.demo.map((row) => row.id), ['old', 'new'])
})

test('keeps dry-run read-only by not persisting the catalog cache', async () => {
  const { ctx } = makeContext()
  let saves = 0
  const sync = createModelSynchronizer(ctx, {
    saveConfig: async () => { saves += 1 },
    fetchImpl: async () => response({ data: [{ id: 'new', name: 'New' }] }),
  })
  await sync.run({ provider: 'demo', dryRun: true })
  assert.equal(saves, 0)
})

test('applies and persists a model allowlist while retaining the full available catalog', async () => {
  const { ctx, section } = makeContext()
  let config = { modelSelections: {} }
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => { config = { ...config, ...patch } },
    fetchImpl: async () => response({ data: [{ id: 'old', name: 'Old' }, { id: 'new', name: 'New' }] }),
  })
  await sync.run({ provider: 'demo', dryRun: true })
  const narrowed = await sync.setModelSelection('demo', ['new'])
  assert.equal(narrowed.applied, true)
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['new'])
  assert.deepEqual(config.modelSelections.demo, ['new'])
  assert.deepEqual(sync.getProvider('demo').availableModels.map((row) => row.id), ['old', 'new'])
  const restored = await sync.setModelSelection('demo', [])
  assert.deepEqual(restored.models.map((row) => row.id), ['old', 'new'])
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old', 'new'])
})


test('does not write the catalog when the allowlist cannot be persisted', async () => {
  const { ctx, section } = makeContext()
  let saveCalls = 0
  const sync = createModelSynchronizer(ctx, {
    saveConfig: async () => {
      saveCalls += 1
      throw Object.assign(new Error('settings unavailable'), { code: 'CONFIG_UNAVAILABLE' })
    },
    fetchImpl: async () => response({ data: [{ id: 'old', name: 'Old' }, { id: 'new', name: 'New' }] }),
  })
  await sync.run({ provider: 'demo', dryRun: true })
  await assert.rejects(() => sync.setModelSelection('demo', ['new']), /settings unavailable/)
  assert.equal(saveCalls, 1)
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old'])
})

test('rolls the allowlist back when the catalog write fails', async () => {
  const { ctx, section, settings } = makeContext()
  settings.replace = async () => { throw new Error('catalog unavailable') }
  let config = { modelSelections: {} }
  const saved = []
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => {
      saved.push(structuredClone(patch))
      config = { ...config, ...patch }
    },
    fetchImpl: async () => response({ data: [{ id: 'old', name: 'Old' }, { id: 'new', name: 'New' }] }),
  })
  await sync.run({ provider: 'demo', dryRun: true })
  await assert.rejects(() => sync.setModelSelection('demo', ['new']), /catalog unavailable/)
  assert.deepEqual(saved, [
    { modelSelections: { demo: ['new'] } },
    { modelSelections: {} },
  ])
  assert.deepEqual(config.modelSelections, {})
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old'])
})


test('persists bounded history and restores it after restart', async () => {
  const { ctx, section } = makeContext()
  let config = { modelSelections: {}, historyLimit: 2, history: [] }
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => { config = { ...config, ...structuredClone(patch) } },
    fetchImpl: async () => response({ data: [{ id: 'new', name: 'New' }] }),
  })
  const result = await sync.run({ provider: 'demo', dryRun: false })
  assert.equal(result.historyPersisted, true)
  assert.equal(config.history.length, 1)
  assert.equal(config.history[0].providers[0].before[0].id, 'old')
  const restarted = createModelSynchronizer(ctx, { getConfig: () => config })
  assert.equal(restarted.status().history[0].id, result.historyId)
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old', 'new'])
})

test('rolls back only the selected catalog and leaves model allowlist untouched', async () => {
  const { ctx, section } = makeContext()
  let config = { modelSelections: { demo: ['new'] }, history: [] }
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => { config = { ...config, ...structuredClone(patch) } },
    fetchImpl: async () => response({ data: [{ id: 'new', name: 'New' }] }),
  })
  const result = await sync.run({ provider: 'demo', dryRun: false })
  const rollback = await sync.rollbackHistory({ historyId: result.historyId, provider: 'demo' })
  assert.equal(rollback.applied, true)
  assert.equal(rollback.allowlistUntouched, true)
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old'])
  assert.deepEqual(config.modelSelections.demo, ['new'])
})


test('keeps stale catalogs across repeated discovery gaps and removes only after explicit grace action', async () => {
  const { ctx, section } = makeContext()
  let config = { modelCatalogs: {}, modelLifecycle: {}, staleGraceRuns: 2, history: [] }
  let calls = 0
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => { config = { ...config, ...structuredClone(patch) } },
    fetchImpl: async () => response({ data: calls++ === 0 ? [{ id: 'old', name: 'Old' }] : [] }),
  })
  await sync.run({ provider: 'demo', dryRun: false })
  const gap = await sync.run({ provider: 'demo', dryRun: false })
  assert.equal(gap.results[0].lifecycle[0].status, 'stale')
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), ['old'])
  assert.deepEqual(config.modelCatalogs.demo.map((row) => row.id), ['old'])
  const removed = await sync.run({ provider: 'demo', dryRun: false, removeMissing: true })
  assert.equal(removed.results[0].lifecycle[0].status, 'removed')
  assert.deepEqual(section.providers.demo.models.map((row) => row.id), [])
  assert.equal(config.modelLifecycle.demo.old.status, 'removed')
})

test('does not advance lifecycle state on discovery failure', async () => {
  const { ctx } = makeContext()
  let config = { modelCatalogs: { demo: [{ id: 'old', name: 'Old' }] }, modelLifecycle: { demo: { old: { status: 'active', consecutiveMissing: 0 } } }, history: [] }
  const sync = createModelSynchronizer(ctx, {
    getConfig: () => config,
    saveConfig: async (patch) => { config = { ...config, ...structuredClone(patch) } },
    fetchImpl: async () => { throw Object.assign(new Error('temporary upstream outage'), { status: 503 }) },
  })
  const result = await sync.run({ provider: 'demo', dryRun: false, retryAttempts: 1 })
  assert.equal(result.results[0].status, 'error')
  assert.equal(config.modelLifecycle.demo.old.status, 'active')
  assert.equal(config.modelLifecycle.demo.old.consecutiveMissing, 0)
})
