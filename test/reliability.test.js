import test from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogRequestError,
  createTimeoutSignal,
  isRetryableError,
  mapWithConcurrency,
  retryWithBackoff,
} from '../lib/reliability.js'

test('classifies transient catalog failures but not credential failures', () => {
  assert.equal(isRetryableError(catalogRequestError(503)), true)
  assert.equal(isRetryableError(catalogRequestError(429)), true)
  assert.equal(isRetryableError(catalogRequestError(401)), false)
  assert.equal(isRetryableError(new Error('invalid JSON')), false)
})

test('retries transient failures with bounded backoff', async () => {
  let calls = 0
  const value = await retryWithBackoff(async () => {
    calls += 1
    if (calls < 3) throw catalogRequestError(503)
    return 'ok'
  }, { attempts: 3, baseDelayMs: 0, maxDelayMs: 0 })
  assert.equal(value, 'ok')
  assert.equal(calls, 3)
})

test('limits concurrent workers and preserves result order', async () => {
  let active = 0
  let maximum = 0
  const values = await mapWithConcurrency([1, 2, 3, 4], async (value) => {
    active += 1
    maximum = Math.max(maximum, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return value * 2
  }, 2)
  assert.equal(maximum, 2)
  assert.deepEqual(values, [2, 4, 6, 8])
})

test('aborts a timed request signal', async () => {
  const timed = createTimeoutSignal(undefined, 5)
  await new Promise((resolve) => timed.signal.addEventListener('abort', resolve, { once: true }))
  assert.equal(timed.signal.aborted, true)
  assert.equal(timed.signal.reason.name, 'TimeoutError')
  timed.cleanup()
})
