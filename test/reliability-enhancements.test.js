import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogRequestError, parseRetryAfter, retryWithBackoff } from '../lib/reliability.js'

test('parseRetryAfter extracts numeric seconds and computes milliseconds', () => {
  const response = { headers: new Map([['retry-after', '12']]) }
  const ms = parseRetryAfter(response)
  assert.equal(ms, 12000)
})

test('parseRetryAfter extracts HTTP date format', () => {
  const future = new Date(Date.now() + 30000).toUTCString()
  const response = { headers: new Map([['retry-after', future]]) }
  const ms = parseRetryAfter(response)
  assert.ok(ms >= 25000 && ms <= 35000)
})

test('parseRetryAfter extracts x-ratelimit-reset', () => {
  const response = { headers: new Map([['x-ratelimit-reset', '15']]) }
  const ms = parseRetryAfter(response)
  assert.equal(ms, 15000)
})

test('parseRetryAfter returns undefined when headers are missing or invalid', () => {
  assert.equal(parseRetryAfter(null), undefined)
  assert.equal(parseRetryAfter({ headers: new Map() }), undefined)
  assert.equal(parseRetryAfter({ headers: new Map([['retry-after', 'invalid']]) }), undefined)
})

test('catalogRequestError sets retryAfterMs from response headers', () => {
  const response = { headers: new Map([['retry-after', '5']]) }
  const error = catalogRequestError(429, response)
  assert.equal(error.status, 429)
  assert.equal(error.retryAfterMs, 5000)
})

test('retryWithBackoff respects error.retryAfterMs for delay', async () => {
  let attempts = 0
  const observedDelays = []
  const error = new Error('rate limited')
  error.status = 429
  error.retryAfterMs = 50

  const op = async () => {
    attempts++
    if (attempts === 1) throw error
    return 'ok'
  }

  const result = await retryWithBackoff(op, {
    attempts: 2,
    baseDelayMs: 10,
    maxDelayMs: 200,
    onRetry: ({ delayMs }) => { observedDelays.push(delayMs) },
  })

  assert.equal(result, 'ok')
  assert.equal(attempts, 2)
  assert.deepEqual(observedDelays, [50])
})
