import { createHash } from 'node:crypto'

export const DEFAULT_NOTIFICATION_LIMIT = 50
export const MAX_NOTIFICATION_LIMIT = 200

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.floor(number)))
}

export function notificationLimit(value) {
  return boundedInteger(value, DEFAULT_NOTIFICATION_LIMIT, 1, MAX_NOTIFICATION_LIMIT)
}

function safeMessage(value) {
  return String(value ?? '')
    .replace(/(api[_-]?key|token|secret|authorization|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/([?&](?:key|token|api[_-]?key|access[_-]?token)=)[^&#\s]+/gi, '$1[redacted]')
    .slice(0, 240)
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

function statusClass(status) {
  if (status === 'ok') return 'success'
  if (status === 'error' || status === 'circuit-open') return 'failure'
  return 'skipped'
}

function countsFor(rows) {
  return rows.reduce((counts, row) => {
    const diff = row?.diff ?? {}
    counts.added += Array.isArray(diff.added) ? diff.added.length : 0
    counts.removed += Array.isArray(diff.removed) ? diff.removed.length : 0
    counts.renamed += Array.isArray(diff.renamed) ? diff.renamed.length : 0
    counts.changed += Array.isArray(diff.changed) ? diff.changed.length : 0
    counts.stale += Array.isArray(row?.stale) ? row.stale.length : 0
    return counts
  }, { added: 0, removed: 0, renamed: 0, changed: 0, stale: 0 })
}

export function createSyncReport(result, { source = 'manual' } = {}) {
  const rows = Array.isArray(result?.results) ? result.results : []
  const statuses = rows.map((row) => statusClass(row?.status))
  const succeeded = statuses.filter((status) => status === 'success').length
  const failed = statuses.filter((status) => status === 'failure').length
  const skipped = statuses.filter((status) => status === 'skipped').length
  const outcome = failed > 0 && succeeded > 0
    ? 'partial'
    : failed > 0 ? 'failure'
      : succeeded > 0 ? 'success'
        : 'empty'
  const severity = outcome === 'failure' ? 'error' : outcome === 'partial' ? 'warning' : outcome === 'success' ? 'success' : 'info'
  const providers = rows.map((row) => ({
    provider: String(row?.provider ?? ''),
    status: String(row?.status ?? 'unknown'),
    class: statusClass(row?.status),
    changed: Boolean(row?.changed),
    ...(Number.isFinite(row?.retries) ? { retries: row.retries } : {}),
    ...(row?.message ? { message: safeMessage(row.message) } : {}),
    counts: {
      added: Array.isArray(row?.diff?.added) ? row.diff.added.length : 0,
      removed: Array.isArray(row?.diff?.removed) ? row.diff.removed.length : 0,
      renamed: Array.isArray(row?.diff?.renamed) ? row.diff.renamed.length : 0,
      changed: Array.isArray(row?.diff?.changed) ? row.diff.changed.length : 0,
      stale: Array.isArray(row?.stale) ? row.stale.length : 0,
    },
  })).sort((left, right) => left.provider.localeCompare(right.provider))
  const report = {
    version: 1,
    source: source === 'schedule' ? 'schedule' : 'manual',
    startedAt: Number.isFinite(result?.startedAt) ? result.startedAt : Date.now(),
    finishedAt: Number.isFinite(result?.finishedAt) ? result.finishedAt : Date.now(),
    dryRun: result?.dryRun !== false,
    outcome,
    severity,
    counts: {
      providers: rows.length,
      succeeded,
      failed,
      skipped,
      changed: providers.filter((row) => row.changed).length,
      models: countsFor(rows),
    },
    providers,
  }
  const fingerprintPayload = { outcome, severity, dryRun: report.dryRun, counts: report.counts, providers }
  report.fingerprint = createHash('sha256').update(JSON.stringify(stable(fingerprintPayload))).digest('hex').slice(0, 24)
  return report
}

export function notificationForReport(report, { now = Date.now() } = {}) {
  if (!report || (report.outcome !== 'failure' && report.outcome !== 'partial')) return null
  const failed = report.providers.filter((row) => row.class === 'failure')
  const title = report.outcome === 'partial' ? 'Model sync partially completed' : 'Model sync failed'
  const message = report.outcome === 'partial'
    ? report.counts.succeeded + ' providers succeeded; ' + report.counts.failed + ' failed'
    : report.counts.failed + ' providers failed'
  return {
    id: 'sync-notice-' + report.fingerprint,
    fingerprint: report.fingerprint,
    createdAt: now,
    updatedAt: now,
    occurrences: 1,
    readAt: null,
    acknowledgedAt: null,
    severity: report.severity,
    title,
    message,
    providers: failed.map((row) => ({ provider: row.provider, status: row.status, ...(row.message ? { message: row.message } : {}) })),
  }
}

export function appendNotification(existing, report, { limit = DEFAULT_NOTIFICATION_LIMIT, now = Date.now() } = {}) {
  const notification = notificationForReport(report, { now })
  const rows = Array.isArray(existing) ? existing.filter((row) => row && typeof row === 'object') : []
  if (!notification) return rows.slice(-notificationLimit(limit))
  const index = rows.findIndex((row) => row.fingerprint === notification.fingerprint)
  if (index >= 0) {
    const current = structuredClone(rows[index])
    rows.splice(index, 1)
    rows.push({
      ...current,
      updatedAt: now,
      occurrences: boundedInteger(current.occurrences, 1, 1, 1000000) + 1,
    })
  } else {
    rows.push(notification)
  }
  return rows.slice(-notificationLimit(limit))
}

export function updateNotification(existing, id, field, { now = Date.now() } = {}) {
  if (field !== 'read' && field !== 'acknowledged') throw Object.assign(new Error('notification field is invalid'), { code: 'INVALID_NOTIFICATION' })
  if (typeof id !== 'string' || !id || id.length > 128) throw Object.assign(new Error('notification id is invalid'), { code: 'INVALID_NOTIFICATION' })
  const rows = Array.isArray(existing) ? existing.map((row) => structuredClone(row)) : []
  const row = rows.find((item) => item?.id === id)
  if (!row) throw Object.assign(new Error('notification not found'), { code: 'NOTIFICATION_NOT_FOUND' })
  row[field === 'read' ? 'readAt' : 'acknowledgedAt'] = now
  return rows
}

export function listNotifications(existing, { includeAcknowledged = true } = {}) {
  const rows = Array.isArray(existing) ? existing : []
  return rows
    .filter((row) => includeAcknowledged || !row?.acknowledgedAt)
    .slice()
    .sort((left, right) => Number(right.updatedAt ?? right.createdAt ?? 0) - Number(left.updatedAt ?? left.createdAt ?? 0))
    .map((row) => structuredClone(row))
}
