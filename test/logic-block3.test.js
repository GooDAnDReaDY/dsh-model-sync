import test from 'node:test'
import assert from 'node:assert/strict'

import { createModelProber } from '../lib/synchronizer-prober.js'
import { extractDiffEvents } from '../lib/diff-notifier.js'
import { isVirtualAlias, resolveAlias } from '../lib/alias-resolver.js'
import { filterModels, validatePolicy } from '../lib/policy.js'
import { lookupReferencePricing } from '../lib/pricing-database.js'
import { appendNotification, createSyncReport, notificationForReport } from '../lib/reporting.js'
import { createSyncScheduler } from '../lib/scheduler.js'

test('issue #195: tryModel and batchTryModels validate model existence and batch provider health', async () => {
  let healthCalls = 0
  const mockHealth = async () => {
    healthCalls++
    return { results: [{ provider: 'openai', status: 'ok' }] }
  }
  const catalog = [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }]
  const prober = createModelProber({
    health: mockHealth,
    getProviderCatalog: () => catalog,
  })

  // Known model passes
  const resOk = await prober.tryModel({ provider: 'openai', model: 'gpt-4o' })
  assert.equal(resOk.ok, true)
  assert.equal(resOk.status, 'ok')

  // Unknown model fails with model_not_found
  const resBad = await prober.tryModel({ provider: 'openai', model: 'non-existent-model' })
  assert.equal(resBad.ok, false)
  assert.equal(resBad.status, 'model_not_found')
  assert.match(resBad.error, /not found in provider catalog/)

  // batchTryModels runs health probe ONCE for the batch, not per model
  const prevHealthCalls = healthCalls
  const batchRes = await prober.batchTryModels({
    provider: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini', 'non-existent-model']
  })
  assert.equal(healthCalls, prevHealthCalls + 1, 'health should be called exactly once for batch')
  assert.equal(batchRes.summary.total, 3)
  assert.equal(batchRes.summary.reachable, 2)
  assert.equal(batchRes.summary.unreachable, 1)
})

test('issue #198: price-change detector compares before-input with after-input, before-output with after-output', () => {
  // Case: Only output price changed, input is identical
  const diffOutputOnly = extractDiffEvents([{
    provider: 'openai',
    diff: {
      changed: [{
        before: { id: 'm1', pricing: { inputPerToken: 0.000001, outputPerToken: 0.000002 } },
        after: { id: 'm1', pricing: { inputPerToken: 0.000001, outputPerToken: 0.000003 } },
      }],
    },
  }], { notifyOnPriceChanged: true })

  assert.equal(diffOutputOnly.priceChanged.length, 1)
  assert.equal(diffOutputOnly.priceChanged[0].id, 'm1')

  // Case: No price changes at all (output != input, but before == after)
  const diffNoChange = extractDiffEvents([{
    provider: 'openai',
    diff: {
      changed: [{
        before: { id: 'm1', pricing: { inputPerToken: 0.000001, outputPerToken: 0.000005 } },
        after: { id: 'm1', pricing: { inputPerToken: 0.000001, outputPerToken: 0.000005 } },
      }],
    },
  }], { notifyOnPriceChanged: true })

  assert.equal(diffNoChange.priceChanged.length, 0, 'should not report price change when pricing did not change')
})

test('issue #199: @fast alias resolution uses real probe measurements when available', () => {
  const modelCatalogs = {
    openai: [{ id: 'gpt-slow', name: 'Slow' }, { id: 'gpt-fast', name: 'Fast' }],
  }
  const modelProbes = {
    'openai:gpt-slow': { latencyMs: 500, ok: true },
    'openai:gpt-fast': { latencyMs: 80, ok: true },
  }

  const res = resolveAlias('@fast', {
    modelCatalogs,
    modelProbes,
  })

  assert.equal(res.strategy, 'fastest')
  assert.equal(res.model, 'gpt-fast')
  assert.equal(res.latencyMs, 80)
  assert.equal(res.reason, 'lowest_latency')

  // Without probes, falls back to estimated latency with reason 'estimated_lowest_latency'
  const resNoProbe = resolveAlias('@fast', {
    modelCatalogs,
    modelProbes: {},
  })
  assert.equal(resNoProbe.strategy, 'fastest')
  assert.equal(resNoProbe.reason, 'estimated_lowest_latency')
})

test('issue #200: isVirtualAlias returns true only for virtual aliases or valid strategies', () => {
  assert.equal(isVirtualAlias('@fast'), true)
  assert.equal(isVirtualAlias('@cheap'), true)
  assert.equal(isVirtualAlias('@best-code'), true)
  assert.equal(isVirtualAlias('@custom'), false)
  assert.equal(isVirtualAlias('@my-model'), false)
  assert.equal(isVirtualAlias('regular-alias'), false)
  assert.equal(isVirtualAlias('@custom', 'fastest'), true)
  assert.equal(isVirtualAlias('@custom', 'invalid-strategy'), false)
})

test('issue #201: capability filters ignore expected=false and do not empty catalog', () => {
  const catalog = [
    { id: 'm-code', capabilities: { code: true } },
    { id: 'm-unknown' }, // no capabilities defined
    { id: 'm-no-code', capabilities: { code: false } },
  ]

  // requireCapabilities: { code: false } means "do not require code"
  const filtered = filterModels(catalog, { requireCapabilities: { code: false } })
  assert.equal(filtered.length, 3, 'should retain all models when code is not required')

  // requireCapabilities: { code: true } requires code
  const filteredCode = filterModels(catalog, { requireCapabilities: { code: true } })
  assert.equal(filteredCode.length, 1)
  assert.equal(filteredCode[0].id, 'm-code')

  // denyCapabilities: { code: true } denies code
  const filteredNoCode = filterModels(catalog, { denyCapabilities: { code: true } })
  assert.equal(filteredNoCode.length, 2)
  assert.deepEqual(filteredNoCode.map((m) => m.id), ['m-unknown', 'm-no-code'])
})

test('issue #202: user-supplied regex with catastrophic backtracking risk is rejected', () => {
  // Nested quantifiers
  assert.throws(
    () => validatePolicy({ include: ['(a+)+$'] }),
    (err) => err.code === 'INVALID_POLICY' && /catastrophic backtracking risk/.test(err.message)
  )
  assert.throws(
    () => validatePolicy({ exclude: ['(x*)*'] }),
    (err) => err.code === 'INVALID_POLICY' && /catastrophic backtracking risk/.test(err.message)
  )
  assert.throws(
    () => validatePolicy({ include: ['(a+){2,}'] }),
    (err) => err.code === 'INVALID_POLICY' && /catastrophic backtracking risk/.test(err.message)
  )

  // Normal patterns compile fine
  const normal = validatePolicy({ include: ['gpt-4.*', 'claude-[0-9]+'] })
  assert.equal(normal.include.length, 2)
})

test('issue #203: lookupReferencePricing does not match unanchored prefixes or leak cross-provider pricing', () => {
  // deepseek-coder-v2 should not inherit deepseek-coder pricing
  assert.equal(lookupReferencePricing('deepseek', 'deepseek-coder-v2'), undefined)

  // gpt-4o-audio-realtime should not inherit gpt-4o pricing
  assert.equal(lookupReferencePricing('openai', 'gpt-4o-audio-realtime'), undefined)

  // groq provider should not inherit Anthropic pricing for claude-3-5-sonnet
  assert.equal(lookupReferencePricing('groq', 'claude-3-5-sonnet'), undefined)

  // Exact model matches still work
  const gpt4o = lookupReferencePricing('openai', 'gpt-4o')
  assert.ok(gpt4o)
  assert.equal(gpt4o.inputPerToken, 0.0000025)

  // Date cleaned snapshot still works
  const sonnetDated = lookupReferencePricing('anthropic', 'claude-3-5-sonnet-20241022')
  assert.ok(sonnetDated)
  assert.equal(sonnetDated.inputPerToken, 0.000003)
})

test('issue #208: occurrence counter clamps to 1000000 and does not saturate at 1000001', () => {
  const report = createSyncReport({
    results: [{ provider: 'p1', status: 'error', error: 'e1' }],
  })
  const initial = notificationForReport(report)
  initial.occurrences = 999999
  const existing = [initial]

  const updated1 = appendNotification(existing, report)
  assert.equal(updated1[0].occurrences, 1000000)

  // Next occurrence should stay capped at 1000000, not 1000001
  const updated2 = appendNotification(updated1, report)
  assert.equal(updated2[0].occurrences, 1000000)
})

test('issue #209: status() does not mutate scheduler provider states on read-only call', () => {
  let currentTime = 10000
  const scheduler = createSyncScheduler({
    getConfig: () => ({ enabled: true, scheduleEnabled: true, intervalMinutes: 60 }),
    inventory: () => ['demo'],
    now: () => currentTime,
  })

  // Before start: status is inactive and has no providers registered
  const s0 = scheduler.status()
  assert.equal(s0.active, false)
  assert.deepEqual(s0.providers, {})

  // Start scheduler
  scheduler.start()
  const s1 = scheduler.status()
  assert.equal(s1.active, true)
  assert.ok(s1.providers['*'])

  const initialNextRunAt = s1.providers['*'].nextRunAt

  // Advancing time and calling status() multiple times should NOT change nextRunAt or mutate state
  currentTime += 5000
  const s2 = scheduler.status()
  assert.equal(s2.providers['*'].nextRunAt, initialNextRunAt)

  scheduler.stop()
})
