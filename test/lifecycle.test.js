import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeModel } from '../lib/models.js'
import { updateLifecycle } from '../lib/lifecycle.js'

test('keeps a temporarily missing model stale through the grace period', () => {
  const first = updateLifecycle({}, [{ id: 'old', name: 'Old' }], [], { runNumber: 1, staleGraceRuns: 2 })
  assert.equal(first.statuses[0].status, 'stale')
  assert.equal(first.statuses[0].consecutiveMissing, 1)
  assert.deepEqual(first.removedIds, [])
  const second = updateLifecycle(first.records, [{ id: 'old', name: 'Old' }], [], { runNumber: 2, staleGraceRuns: 2 })
  assert.equal(second.statuses[0].status, 'stale')
  assert.equal(second.statuses[0].consecutiveMissing, 2)
  assert.deepEqual(second.removedIds, [])
})

test('requires explicit removal after grace and retains an audit record', () => {
  const previous = { old: { status: 'stale', consecutiveMissing: 2, firstMissingAt: 1, lastObservedRun: 2 } }
  const result = updateLifecycle(previous, [{ id: 'old', name: 'Old' }], [], { runNumber: 3, staleGraceRuns: 2, removeMissing: true })
  assert.deepEqual(result.removedIds, ['old'])
  assert.equal(result.records.old.status, 'removed')
  assert.match(result.records.old.reason, /missing for 3/)
})

test('normalizes explicit provider deprecation signals without guessing', () => {
  assert.deepEqual(normalizeModel('demo', { id: 'old', deprecated: true }).lifecycle, { deprecated: true })
  assert.deepEqual(normalizeModel('demo', { id: 'future', expiration_date: '2099-01-01T00:00:00Z' }).lifecycle, { deprecationDate: '2099-01-01T00:00:00Z' })
  assert.equal(normalizeModel('demo', { id: 'plain' }).lifecycle, undefined)
  const result = updateLifecycle({}, [], [{ id: 'old', lifecycle: { deprecated: true } }], { runNumber: 1 })
  assert.equal(result.records.old.status, 'deprecated')
})
