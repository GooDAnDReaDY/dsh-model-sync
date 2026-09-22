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


test('applies jitter factor to retry backoff delay', async () => {
  let calls = 0
  const delays = []
  const value = await retryWithBackoff(async () => {
    calls += 1
    if (calls < 2) throw catalogRequestError(503)
    return 'ok'
  }, {
    attempts: 2,
    baseDelayMs: 200,
    maxDelayMs: 500,
    jitter: true,
    onRetry: ({ delayMs }) => { delays.push(delayMs) },
  })
  assert.equal(value, 'ok')
  assert.equal(calls, 2)
  assert.equal(delays.length, 1)
  // Jitter factor is in [0.5, 1.0] range of 200ms -> [100ms, 200ms]
  assert.ok(delays[0] >= 100 && delays[0] <= 200, `delayMs ${delays[0]} should be between 100 and 200`)
})
