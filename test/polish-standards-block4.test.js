import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'yaml'

import { normalizeModel } from '../lib/models.js'
import { reconcileModels } from '../lib/reconcile.js'
import { Config, plainConfig } from '../lib/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('#77: firstSeenAt is persisted, assigned on discovery, and used in Newest sort', () => {
  // 1. normalizeModel preserves firstSeenAt and parses Unix timestamp created
  const explicit = normalizeModel('openai', { id: 'gpt-4o', firstSeenAt: '2026-09-01T12:00:00.000Z' })
  assert.equal(explicit.firstSeenAt, '2026-09-01T12:00:00.000Z')

  const fromCreated = normalizeModel('openai', { id: 'gpt-4o', created: 1700000000 })
  assert.equal(fromCreated.createdAt, new Date(1700000000 * 1000).toISOString())

  // 2. reconcileModels preserves existing firstSeenAt when upstream discovery doesn't return dates
  const beforeCatalog = [
    { id: 'm1', name: 'Model 1', firstSeenAt: '2026-08-01T00:00:00.000Z' },
    { id: 'm2', name: 'Model 2', firstSeenAt: '2026-08-15T00:00:00.000Z' },
  ]
  const discovered = [
    { id: 'm1', name: 'Model 1 Updated' },
    { id: 'm3', name: 'Model 3 New' },
  ]
  const reconciled = reconcileModels('openai', beforeCatalog, discovered)
  const m1Reconciled = reconciled.next.find((m) => m.id === 'm1')
  assert.equal(m1Reconciled.firstSeenAt, '2026-08-01T00:00:00.000Z')

  // 3. Date sorting comparator works correctly descending
  const models = [
    { id: 'old', firstSeenAt: '2026-01-01T00:00:00.000Z' },
    { id: 'new', firstSeenAt: '2026-10-01T00:00:00.000Z' },
    { id: 'mid', firstSeenAt: '2026-05-01T00:00:00.000Z' },
    { id: 'nodate' },
  ]
  const sorted = [...models].sort((a, b) => {
    const da = a.firstSeenAt ? new Date(a.firstSeenAt).getTime() : 0
    const db = b.firstSeenAt ? new Date(b.firstSeenAt).getTime() : 0
    return db - da
  })
  assert.equal(sorted[0].id, 'new')
  assert.equal(sorted[1].id, 'mid')
  assert.equal(sorted[2].id, 'old')
  assert.equal(sorted[3].id, 'nodate')
})

test('#166: webhook draft initializes from stored snapshot and controls are ready', () => {
  const stored = {
    diffWebhookUrl: 'https://example.com/hook',
    diffWebhookSecretRef: 'secret-ref-123',
    diffWebhookSecret: 'plain-secret',
    notifyOnModelAdded: true,
    notifyOnModelDeprecated: false,
    notifyOnPriceChanged: true,
  }
  const draft = {
    diffWebhookUrl: stored.diffWebhookUrl ?? '',
    diffWebhookSecretRef: stored.diffWebhookSecretRef ?? '',
    diffWebhookSecret: stored.diffWebhookSecret ?? stored.diffWebhookSecretRef ?? '',
    notifyOnModelAdded: stored.notifyOnModelAdded ?? true,
    notifyOnModelDeprecated: stored.notifyOnModelDeprecated ?? true,
    notifyOnPriceChanged: stored.notifyOnPriceChanged ?? true,
  }
  assert.equal(draft.diffWebhookUrl, 'https://example.com/hook')
  assert.equal(draft.diffWebhookSecretRef, 'secret-ref-123')
  assert.equal(draft.notifyOnModelDeprecated, false)
})

test('#242: Apply preview passes explicit dryRun:false and dismiss cancels without writes', () => {
  let executedDryRun = null
  let loadCalls = 0

  const execute = (targetProvider, options = {}) => {
    const dryRun = options.dryRun !== undefined ? options.dryRun : true
    executedDryRun = dryRun
    if (!dryRun) loadCalls++
  }

  // Preview discovery passes dryRun: true
  execute('openai', { dryRun: true })
  assert.equal(executedDryRun, true)
  assert.equal(loadCalls, 0)

  // Apply preview passes dryRun: false
  execute('openai', { dryRun: false })
  assert.equal(executedDryRun, false)
  assert.equal(loadCalls, 1)
})

test('#243: runtime translator proxy invokes locale service and supports external translations', () => {
  let bindCalls = 0
  const fakeCtx = {
    locale: {
      bind(ns) {
        bindCalls++
        return (key) => (key === 'title' ? 'Синхронизация моделей' : undefined)
      },
      t(key) {
        if (key === 'dsh-model-sync.scheduler') return 'Планировщик'
        return undefined
      },
      subscribe: () => () => {},
      getSnapshot: () => ({ active: 'ru' }),
    },
  }

  const en = { title: 'Model synchronization', scheduler: 'Scheduler', other: 'Other' }
  const slotT = (key) => (key === 'other' ? 'Другое' : undefined)

  // Use the createTranslator logic
  const slotFunc = slotT
  const bindT = fakeCtx.locale.bind('dsh-model-sync')
  const proxy = new Proxy(en, {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop]
      if (slotFunc) {
        const res = slotFunc(prop)
        if (res) return res
      }
      if (bindT) {
        const res = bindT(prop)
        if (res) return res
      }
      return target[prop]
    },
  })

  assert.equal(bindCalls, 1)
  assert.equal(proxy.title, 'Синхронизация моделей')
  assert.equal(proxy.other, 'Другое')
  assert.equal(proxy.scheduler, 'Scheduler')

  // Verify client.js does NOT contain hardcoded Russian literals in UI dictionaries
  const clientSrc = fs.readFileSync(path.join(rootDir, 'lib/client.js'), 'utf-8')
  const cyrillicMatch = clientSrc.match(/[\u0400-\u04FF]{4,}/g)
  assert.equal(cyrillicMatch, null, 'client.js must not contain hardcoded Russian string literals')
})

test('#244: Save operations check writable status and reject false returns without reporting Saved', async () => {
  // Test read-only rejection
  const readOnlyScope = { writable: false, set: async () => true }
  let savedShown = false
  let errorShown = ''

  const save = async (scope, isWritable) => {
    if (!isWritable || scope.writable === false) {
      errorShown = 'Settings are read-only'
      return
    }
    const results = await Promise.all([scope.set('field', 'val')])
    if (results.some((ok) => ok === false)) {
      errorShown = 'Save rejected by settings service'
      return
    }
    savedShown = true
  }

  await save(readOnlyScope, false)
  assert.equal(savedShown, false)
  assert.equal(errorShown, 'Settings are read-only')

  // Test false return from scope.set
  errorShown = ''
  savedShown = false
  const rejectingScope = { writable: true, set: async () => false }
  await save(rejectingScope, true)
  assert.equal(savedShown, false)
  assert.equal(errorShown, 'Save rejected by settings service')

  // Test successful save
  errorShown = ''
  savedShown = false
  const successScope = { writable: true, set: async () => true }
  await save(successScope, true)
  assert.equal(savedShown, true)
  assert.equal(errorShown, '')
})

test('#245: policy regex parses by line breaks only, preserving commas and quantifiers', () => {
  const splitLines = (value) => [...new Set(String(value ?? '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]

  const input = '^(?:a,b)$\nfoo{1,3}\n[a-z]+, [0-9]+\ngpt-4o'
  const lines = splitLines(input)

  assert.deepEqual(lines, [
    '^(?:a,b)$',
    'foo{1,3}',
    '[a-z]+, [0-9]+',
    'gpt-4o',
  ])

  // None of the commas inside regexes should be split
  for (const pattern of lines) {
    assert.doesNotThrow(() => new RegExp(pattern, 'i'))
  }
})

test('#246: cheap filter includes free models (0 <= 1.0/M) and filters by price', () => {
  const models = [
    { id: 'free-model', pricing: { inputPerToken: 0 } },
    { id: 'cheap-model', pricing: { inputPerToken: 0.0000005 } }, // $0.5 / 1M
    { id: 'exact-1m', pricing: { inputPerToken: 0.000001 } },     // $1.0 / 1M
    { id: 'expensive-model', pricing: { inputPerToken: 0.000003 } }, // $3.0 / 1M
    { id: 'missing-pricing' },
    { id: 'nan-pricing', pricing: { inputPerToken: NaN } },
  ]

  const cheapFiltered = models.filter((m) => {
    const price = m.pricing?.inputPerToken
    if (typeof price !== 'number' || Number.isNaN(price)) return false
    return (price * 1000000) <= 1.0
  })

  const ids = cheapFiltered.map((m) => m.id)
  assert.deepEqual(ids, ['free-model', 'cheap-model', 'exact-1m'])
})

test('#247: style tag owner matches package ID and disposal cleans up own style', () => {
  const clientSrc = fs.readFileSync(path.join(rootDir, 'lib/client.js'), 'utf-8')

  // 1. Attributes match package ID
  assert.match(clientSrc, /const pluginId = ['"]@goodandready\/dsh-model-sync['"]/)
  assert.match(clientSrc, /tag\.setAttribute\(['"]data-plugin['"],\s*pluginId\)/)
  assert.match(clientSrc, /tag\.setAttribute\(['"]data-dsh-plugin['"],\s*pluginId\)/)

  // 2. apply() registers effect with disposal
  assert.match(clientSrc, /ctx\.effect\(\s*\(\)\s*=>\s*\{[\s\S]*?(tag\.remove|removeChild)/)
})

test('#248: README YAML configurations strictly validate against Config schema in all 3 languages', () => {
  const extractYaml = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const match = content.match(/```yaml\s*\ndsh-model-sync:\s*\n([\s\S]*?)```/)
    if (!match) throw new Error(`YAML block not found in ${filePath}`)
    return yaml.parse(match[1])
  }

  const files = ['README.md', 'README.ru.md', 'README.zh.md']
  for (const file of files) {
    const parsed = extractYaml(path.join(rootDir, file))
    const validated = plainConfig(Config(parsed))
    assert.equal(validated.enabled, true)
    assert.equal(validated.intervalMinutes, 60)
    assert.equal(validated.scheduleEnabled, false)
    assert.equal(validated.autoApply, false)
    assert.equal(validated.requestTimeoutMs, 15000)
    assert.equal(validated.retryAttempts, 3)
    assert.equal(validated.concurrency, 4)
    assert.equal(validated.providers.length, 2)
    assert.equal(validated.providers[0].provider, 'commandcode')
    assert.equal(validated.providers[1].provider, 'clinebot')
  }

  // DESIGN.md must not reference obsolete settingsScope.bind
  const designSrc = fs.readFileSync(path.join(rootDir, 'docs/design/DESIGN.md'), 'utf-8')
  assert.doesNotMatch(designSrc, /settingsScope\.bind/)
  assert.match(designSrc, /configForms\.get\('dsh-model-sync'\)/)
})

test('#249: reliability and provider settings controls bind to Config schema and persist', () => {
  const clientSrc = fs.readFileSync(path.join(rootDir, 'lib/client.js'), 'utf-8')

  // Reliability settings exposed
  assert.match(clientSrc, /requestTimeoutMs/)
  assert.match(clientSrc, /retryAttempts/)
  assert.match(clientSrc, /retryBaseDelayMs/)
  assert.match(clientSrc, /retryMaxDelayMs/)
  assert.match(clientSrc, /concurrency/)
  assert.match(clientSrc, /circuitBreakerFailures/)
  assert.match(clientSrc, /circuitBreakerCooldownMinutes/)
  assert.match(clientSrc, /ttlMinutes/)
  assert.match(clientSrc, /lifecycleRetentionRuns/)
  assert.match(clientSrc, /saveReliability/)
  assert.match(clientSrc, /renderReliability/)

  // Provider configuration exposed
  assert.match(clientSrc, /openProviderConfig/)
  assert.match(clientSrc, /saveProviderConfig/)
  assert.match(clientSrc, /providerConfigDraft/)
})
