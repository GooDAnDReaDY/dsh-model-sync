import test from 'node:test'
import assert from 'node:assert/strict'
import { appendHistory, compactHistoryEntry, createHistoryEntry } from '../lib/history.js'

test('compactHistoryEntry strips before and after catalog snapshots', () => {
  const entry = createHistoryEntry({
    startedAt: 100, finishedAt: 200, results: [{
      provider: 'demo', status: 'ok', changed: true,
      before: [{ id: 'm1' }], next: [{ id: 'm2' }],
      diff: { added: [{ id: 'm2' }], removed: [], renamed: [], changed: [] },
    }],
  }, { version: 1 })

  assert.equal(entry.providers[0].before.length, 1)
  assert.equal(entry.providers[0].after.length, 1)

  const compacted = compactHistoryEntry(entry)
  assert.equal(compacted.providers[0].before, undefined)
  assert.equal(compacted.providers[0].after, undefined)
  assert.equal(compacted.providers[0].counts.added, 1)
  assert.equal(compacted.providers[0].status, 'ok')
})

test('appendHistory compacts entries older than retainSnapshots', () => {
  let history = []
  for (let v = 1; v <= 8; v++) {
    const entry = createHistoryEntry({
      startedAt: v, finishedAt: v, results: [{
        provider: 'demo', status: 'ok', changed: true,
        before: [{ id: `model-${v}` }], next: [{ id: `model-${v + 1}` }],
        diff: { added: [], removed: [], renamed: [], changed: [] },
      }],
    }, { version: v })
    history = appendHistory(history, entry, 50, { retainSnapshots: 3 })
  }

  assert.equal(history.length, 8)
  // The first 5 entries (8 - 3 = 5) should be compacted:
  for (let i = 0; i < 5; i++) {
    assert.equal(history[i].providers[0].before, undefined)
    assert.equal(history[i].providers[0].after, undefined)
  }
  // The last 3 entries should retain full before/after snapshots for rollback:
  for (let i = 5; i < 8; i++) {
    assert.ok(Array.isArray(history[i].providers[0].before))
    assert.ok(Array.isArray(history[i].providers[0].after))
  }
})
