import { normalizeModels } from './models.js'

export const DEFAULT_HISTORY_LIMIT = 50
export const MAX_HISTORY_LIMIT = 200
export const MAX_HISTORY_MODELS = 5000
const MAX_MESSAGE_LENGTH = 512

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.floor(number)))
}

export function historyLimit(value) {
  return boundedInteger(value, DEFAULT_HISTORY_LIMIT, 1, MAX_HISTORY_LIMIT)
}

function cloneModel(provider, model) {
  return structuredClone(normalizeModels(provider, [model])[0] ?? null)
}

function catalog(provider, models) {
  return normalizeModels(provider, models).slice(0, MAX_HISTORY_MODELS)
}

function message(value) {
  if (value === undefined || value === null) return undefined
  return String(value).replace(/(api[_-]?key|token|secret|authorization|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, MAX_MESSAGE_LENGTH)
}

function diffFor(provider, diff) {
  const source = diff && typeof diff === 'object' ? diff : {}
  return {
    added: (source.added ?? []).map((row) => cloneModel(provider, row)).filter(Boolean),
    removed: (source.removed ?? []).map((row) => cloneModel(provider, row)).filter(Boolean),
    renamed: (source.renamed ?? []).map((row) => ({
      before: cloneModel(provider, row?.before),
      after: cloneModel(provider, row?.after),
    })).filter((row) => row.before && row.after),
    changed: (source.changed ?? []).map((row) => ({
      before: cloneModel(provider, row?.before),
      after: cloneModel(provider, row?.after),
    })).filter((row) => row.before && row.after),
  }
}

export function createHistoryEntry(result, { version = 1, maxModels = MAX_HISTORY_MODELS } = {}) {
  const rows = Array.isArray(result?.results) ? result.results : []
  const providers = rows.map((row) => {
    const provider = String(row?.provider ?? '')
    const diff = diffFor(provider, row?.diff)
    const before = catalog(provider, row?.before).slice(0, maxModels)
    const after = catalog(provider, row?.next).slice(0, maxModels)
    return {
      provider,
      status: String(row?.status ?? 'unknown'),
      changed: Boolean(row?.changed),
      ...(Number.isFinite(row?.retries) ? { retries: row.retries } : {}),
      ...(message(row?.message) ? { message: message(row.message) } : {}),
      counts: {
        added: diff.added.length,
        removed: diff.removed.length,
        renamed: diff.renamed.length,
        changed: diff.changed.length,
        stale: Array.isArray(row?.stale) ? row.stale.length : 0,
      },
      diff,
      before,
      after,
    }
  }).sort((left, right) => left.provider.localeCompare(right.provider))
  const startedAt = Number.isFinite(result?.startedAt) ? result.startedAt : Date.now()
  const finishedAt = Number.isFinite(result?.finishedAt) ? result.finishedAt : startedAt
  return {
    id: `sync-${version}-${finishedAt}`,
    version,
    startedAt,
    finishedAt,
    providers,
  }
}

export const DEFAULT_SNAPSHOT_RETENTION = 5

export function compactHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry
  const providers = (entry.providers ?? []).map((provider) => {
    const copy = { ...provider }
    delete copy.before
    delete copy.after
    return copy
  })
  return { ...entry, providers }
}

export function appendHistory(history, entry, limit = DEFAULT_HISTORY_LIMIT, { retainSnapshots = DEFAULT_SNAPSHOT_RETENTION } = {}) {
  const rows = Array.isArray(history) ? history.filter((row) => row && typeof row === 'object') : []
  const next = [...rows, structuredClone(entry)]
  next.sort((left, right) => Number(left.version ?? 0) - Number(right.version ?? 0))
  const bounded = next.slice(-historyLimit(limit))
  const cutoff = Math.max(0, bounded.length - Math.max(1, Number(retainSnapshots) || DEFAULT_SNAPSHOT_RETENTION))
  for (let i = 0; i < cutoff; i++) {
    bounded[i] = compactHistoryEntry(bounded[i])
  }
  return bounded
}

function briefModel(model) {
  if (!model || typeof model !== 'object') return null
  return { id: model.id, name: model.name }
}

function briefDiff(diff) {
  const source = diff ?? {}
  return {
    added: (source.added ?? []).map(briefModel).filter(Boolean),
    removed: (source.removed ?? []).map(briefModel).filter(Boolean),
    renamed: (source.renamed ?? []).map((pair) => ({ before: briefModel(pair.before), after: briefModel(pair.after) })).filter((pair) => pair.before && pair.after),
    changed: (source.changed ?? []).map((pair) => ({ before: briefModel(pair.before), after: briefModel(pair.after) })).filter((pair) => pair.before && pair.after),
  }
}

function summaryProvider(row) {
  return {
    provider: row.provider,
    status: row.status,
    changed: Boolean(row.changed),
    ...(row.retries === undefined ? {} : { retries: row.retries }),
    ...(row.message ? { message: row.message } : {}),
    counts: structuredClone(row.counts ?? { added: 0, removed: 0, renamed: 0, changed: 0, stale: 0 }),
    diff: briefDiff(row.diff),
    hasRollback: Array.isArray(row.before),
  }
}

export function historySummary(entry) {
  return {
    id: entry.id,
    version: entry.version,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    providers: (entry.providers ?? []).map(summaryProvider),
  }
}

export function listHistory(history, { limit = DEFAULT_HISTORY_LIMIT, provider, historyId, details = false } = {}) {
  let rows = Array.isArray(history) ? history : []
  if (historyId) rows = rows.filter((entry) => entry.id === historyId)
  if (provider) rows = rows.map((entry) => ({ ...entry, providers: (entry.providers ?? []).filter((row) => row.provider === provider) })).filter((entry) => entry.providers.length > 0)
  rows = rows.slice().sort((left, right) => Number(right.version ?? 0) - Number(left.version ?? 0)).slice(0, historyLimit(limit))
  return rows.map((entry) => details ? structuredClone(entry) : historySummary(entry))
}

export function historyEntry(history, id) {
  return (Array.isArray(history) ? history : []).find((entry) => entry?.id === id) ?? null
}
