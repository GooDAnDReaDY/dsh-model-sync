import test from 'node:test'
import assert from 'node:assert/strict'
import { createSyncScheduler } from '../lib/scheduler.js'

test('does not schedule when disabled or interval is invalid', () => {
  let calls = 0
  const scheduler = createSyncScheduler({ run: async () => { calls++ } }, { getConfig: () => ({ enabled: false, intervalMinutes: 5 }), setIntervalFn: () => { calls++; return 1 } })
  assert.equal(scheduler.start(), false)
  assert.equal(calls, 0)
})

test('runs scheduled work in dry-run mode by default', async () => {
  let callback
  const runs = []
  const scheduler = createSyncScheduler({ run: async (options) => { runs.push(options) } }, {
    getConfig: () => ({ enabled: true, intervalMinutes: 0.001, autoApply: false }),
    setIntervalFn: (fn, ms) => { callback = fn; assert.equal(ms, 60000); return 3 },
    clearIntervalFn: (id) => assert.equal(id, 3),
  })
  assert.equal(scheduler.start(), true)
  await callback()
  assert.deepEqual(runs, [{ dryRun: true }])
  scheduler.stop()
})

test('autoApply enables explicit writes and prevents overlap', async () => {
  let callback
  let resolveRun
  let calls = 0
  const scheduler = createSyncScheduler({ run: async (options) => { calls++; assert.equal(options.dryRun, false); await new Promise((resolve) => { resolveRun = resolve }) } }, {
    getConfig: () => ({ enabled: true, intervalMinutes: 1, autoApply: true }),
    setIntervalFn: (fn) => { callback = fn; return 4 },
  })
  scheduler.start()
  const first = callback()
  const second = callback()
  assert.equal(calls, 1)
  resolveRun()
  await first
  await second
})
