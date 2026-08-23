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
  return { ctx, section }
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
