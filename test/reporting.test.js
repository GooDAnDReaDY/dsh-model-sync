import test from 'node:test'
import assert from 'node:assert/strict'
import { appendNotification, createSyncReport, listNotifications, notificationForReport, updateNotification } from '../lib/reporting.js'

test('creates stable partial report with aggregate model counts and redaction', () => {
  const input = {
    startedAt: 1,
    finishedAt: 2,
    dryRun: true,
    results: [
      { provider: 'ok', status: 'ok', changed: true, diff: { added: [{ id: 'new' }], removed: [], renamed: [], changed: [] } },
      { provider: 'bad', status: 'error', message: 'apiKey=TOP-SECRET; https://example.test/models?token=SECRET', diff: {} },
    ],
  }
  const report = createSyncReport(input)
  const again = createSyncReport({ ...input, startedAt: 9, finishedAt: 10 })
  assert.equal(report.outcome, 'partial')
  assert.equal(report.severity, 'warning')
  assert.deepEqual(report.counts.providers, 2)
  assert.equal(report.counts.models.added, 1)
  assert.equal(report.providers[0].provider, 'bad')
  assert.equal(report.providers[0].message.includes('TOP-SECRET'), false)
  assert.equal(report.providers[0].message.includes('SECRET'), false)
  assert.equal(report.fingerprint, again.fingerprint)
})

test('deduplicates identical failure notifications and keeps acknowledgement state', () => {
  const report = createSyncReport({ results: [{ provider: 'bad', status: 'error', message: '401' }] })
  const first = appendNotification([], report, { now: 10 })
  const second = appendNotification(first, report, { now: 20 })
  assert.equal(second.length, 1)
  assert.equal(second[0].occurrences, 2)
  const ack = updateNotification(second, second[0].id, 'acknowledged', { now: 30 })
  const third = appendNotification(ack, report, { now: 40 })
  assert.equal(third.length, 1)
  assert.equal(third[0].occurrences, 3)
  assert.equal(third[0].acknowledgedAt, 30)
  assert.equal(listNotifications(third, { includeAcknowledged: false }).length, 0)
})

test('does not notify successful or empty reports', () => {
  assert.equal(notificationForReport(createSyncReport({ results: [{ provider: 'ok', status: 'ok' }] })), null)
  assert.equal(notificationForReport(createSyncReport({ results: [] })), null)
})
