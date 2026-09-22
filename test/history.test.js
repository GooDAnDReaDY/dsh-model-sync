import test from 'node:test'
import assert from 'node:assert/strict'
import { appendHistory, createHistoryEntry, historyLimit, listHistory } from '../lib/history.js'

test('creates compact history entries with diff counts and explicit snapshots', () => {
  const entry = createHistoryEntry({ startedAt: 10, finishedAt: 20, results: [{
    provider: 'demo', status: 'ok', changed: true,
    before: [{ id: 'old', name: 'Old' }], next: [{ id: 'new', name: 'New' }],
    diff: { added: [{ id: 'new', name: 'New' }], removed: [{ id: 'old', name: 'Old' }], renamed: [], changed: [] },
  }] }, { version: 3 })
  assert.equal(entry.id, 'sync-3-20')
  assert.equal(entry.providers[0].counts.added, 1)
  assert.deepEqual(entry.providers[0].before.map((row) => row.id), ['old'])
  assert.deepEqual(listHistory([entry])[0].providers[0].diff.added.map((row) => row.id), ['new'])
})

test('bounds retention and returns newest entries first', () => {
  assert.equal(historyLimit(999), 200)
  const rows = [1, 2, 3].map((version) => createHistoryEntry({ startedAt: version, finishedAt: version, results: [] }, { version }))
  const retained = appendHistory(rows, createHistoryEntry({ startedAt: 4, finishedAt: 4, results: [] }, { version: 4 }), 2)
  assert.deepEqual(retained.map((row) => row.version), [3, 4])
  assert.deepEqual(listHistory(retained).map((row) => row.version), [4, 3])
})

test('does not retain raw credential-shaped fields', () => {
  const entry = createHistoryEntry({ startedAt: 1, finishedAt: 2, results: [{ provider: 'demo', status: 'error', message: 'apiKey=secret', before: [], next: [], diff: {} }] }, { version: 1 })
  assert.equal(JSON.stringify(entry).includes('secret'), false)
  assert.equal(JSON.stringify(entry).includes('[redacted]'), true)
})
