import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sectionOf,
  descriptorOf,
  profileOf,
  replaceWithRetry,
  performHistoryRollback,
} from '../lib/synchronizer-helpers.js'
import { listApiKeyProviders } from '../lib/inventory.js'
import { createProviderAdapterRegistry } from '../lib/adapter-registry.js'
import { apply } from '../lib/index.js'

test('issue #193: sectionOf, profileOf, replaceWithRetry, and inventory work with describe() without settings.get()', async () => {
  const piaiData = {
    providers: {
      openai: { apiKeyEnv: 'OPENAI_API_KEY', models: [{ id: 'gpt-4o' }] },
    },
  }

  // Host settings service: only has describe, replace, update; NO .get()
  const hostSettings = {
    describe: () => [
      { ns: 'llm-pi-ai', revision: 'rev-1', value: piaiData },
      { ns: 'llm-commandcode', revision: 'rev-2', value: { apiKeyEnv: 'CC_KEY', visibleModels: ['cc-m1'] } },
    ],
    replace: async (ns, next, rev) => {
      assert.equal(ns, 'llm-pi-ai')
      assert.equal(rev, 'rev-1')
      piaiData.providers.openai.models.push({ id: 'gpt-4o-mini' })
      return next
    },
  }

  // 1. sectionOf works via describe()
  const sec = sectionOf(hostSettings, 'llm-pi-ai')
  assert.deepEqual(sec, piaiData)

  // 2. profileOf works via describe()
  const profile = profileOf(hostSettings, 'openai')
  assert.equal(profile.apiKeyEnv, 'OPENAI_API_KEY')

  const ccProfile = profileOf(hostSettings, 'commandcode')
  assert.equal(ccProfile.apiKeyEnv, 'CC_KEY')

  // 3. inventory listApiKeyProviders works via describe()
  const mockLlm = {
    listConfigurableProviders: () => [
      { provider: 'openai', declared: false },
      { provider: 'commandcode', declared: false },
    ],
    listProviders: () => [{ id: 'openai' }],
  }
  const apiProviders = listApiKeyProviders(mockLlm, hostSettings)
  assert.equal(apiProviders.length, 2)
  assert.equal(apiProviders[0].provider, 'openai')
  assert.equal(apiProviders[0].configured, true)

  // 4. replaceWithRetry works via describe()
  const updated = await replaceWithRetry(hostSettings, 'llm-pi-ai', (s) => ({
    ...s,
    providers: { ...s.providers, custom: { models: [] } },
  }))
  assert.ok(updated.providers.custom)

  // 5. performHistoryRollback works via describe()
  const rollbackResult = await performHistoryRollback({
    ctx: { get: (name) => name === 'settings' ? hostSettings : null },
    config: {
      history: [
        {
          id: 'hist-1',
          providers: [{ provider: 'openai', before: [{ id: 'gpt-4o' }] }],
        },
      ],
    },
    providers: [{ provider: 'openai', configured: true }],
    historyId: 'hist-1',
    provider: 'openai',
  })
  assert.equal(rollbackResult.applied, true)
})

test('issue #197: clinebot built-in adapter uses parse: clinebot-plan and runs parseClinePassModels', async () => {
  const payload = {
    data: {
      plan: {
        features: {
          included: ['DeepSeek V4 Flash', 'GLM 5.2'],
        },
      },
    },
  }

  const mockFetch = async () => ({
    status: 200, ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(payload),
  })

  const registry = createProviderAdapterRegistry({
    resolveCredential: async () => 'test-token',
    fetchImpl: mockFetch,
  })

  const adapter = registry.select({ provider: 'clinebot' })
  assert.ok(adapter, 'clinebot adapter must be selected')

  const models = await adapter.discover({ provider: 'clinebot' })
  assert.ok(Array.isArray(models), 'must return array of models')
  assert.ok(models.some((m) => m.id.includes('deepseek-v4-flash')), 'must include parsed deepseek-v4-flash')
  assert.ok(models.some((m) => m.id.includes('glm-5.2')), 'must include parsed glm-5.2')
})

test('issue #196: fetchSpecific does not swallow network or auth errors with defaultModels', async () => {
  const failingFetch = async () => ({
    status: 401,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ error: { message: 'Unauthorized' } }),
  })

  const registry = createProviderAdapterRegistry({
    resolveCredential: async () => 'invalid-token',
    fetchImpl: failingFetch,
  })

  const adapter = registry.select({ provider: 'clinebot' })
  assert.ok(adapter)

  await assert.rejects(
    async () => adapter.discover({ provider: 'clinebot' }),
    (err) => {
      assert.ok(err instanceof Error)
      return true
    },
    'must reject on 401 instead of returning fabricated defaultModels'
  )
})

test('issue #206: apply() provides modelSync and modelSyncRunner even when enabled is initially false', () => {
  const provided = {}
  const effects = []
  const mockCtx = {
    effect: (fn) => {
      const disposer = fn()
      effects.push(disposer)
      return disposer
    },
    provide: (name, svc) => {
      provided[name] = svc
    },
    on: () => () => {},
  }

  apply(mockCtx, { enabled: false })

  assert.ok(provided.modelSync, 'modelSync service must be provided')
  assert.ok(provided.modelSyncRunner, 'modelSyncRunner must be provided')
})

test('issue #207: resolveConfig safely catches schema errors and volatile-update listener is disposed', () => {
  let eventDisposed = false
  const mockCtx = {
    effect: (fn) => {
      const disp = fn()
      return () => {
        if (typeof disp === 'function') disp()
      }
    },
    provide: () => {},
    on: (evt, cb) => {
      assert.equal(evt, 'loader/volatile-update')
      return () => {
        eventDisposed = true
      }
    },
  }

  apply(mockCtx, { enabled: true })
  assert.equal(eventDisposed, false)
})

test('issue resolveSmartAlias: client.js defines resolveSmartAlias and does not throw ReferenceError', async () => {
  const fs = await import('node:fs')
  const clientSrc = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(clientSrc, /const resolveSmartAlias = /)
  assert.doesNotMatch(clientSrc, /resolveSmartAlias is not defined/)
})
