export const LIFECYCLE_STATES = Object.freeze(['active', 'stale', 'deprecated', 'removed'])
export const DEFAULT_STALE_GRACE_RUNS = 2
export const DEFAULT_LIFECYCLE_RETENTION_RUNS = 20

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.floor(number)))
}

export function lifecycleOptions(config = {}) {
  return {
    staleGraceRuns: boundedInteger(config.staleGraceRuns, DEFAULT_STALE_GRACE_RUNS, 1, 20),
    lifecycleRetentionRuns: boundedInteger(config.lifecycleRetentionRuns, DEFAULT_LIFECYCLE_RETENTION_RUNS, 1, 200),
  }
}

function dateValue(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function explicitLifecycle(model, now) {
  const source = model?.lifecycle && typeof model.lifecycle === 'object' ? model.lifecycle : {}
  const deprecated = source.deprecated === true || model?.deprecated === true || model?.isDeprecated === true
  const deprecationDate = source.deprecationDate ?? source.deprecation_date ?? source.expirationDate ?? source.expiration_date ?? source.expiresAt ?? source.expires_at
  const deprecationAt = dateValue(deprecationDate)
  return {
    deprecated: deprecated || deprecationAt !== undefined && deprecationAt <= now,
    ...(deprecationAt === undefined ? {} : { deprecationAt }),
  }
}

function recordOf(previous, runNumber, now) {
  const record = previous && typeof previous === 'object' ? structuredClone(previous) : {}
  return {
    status: LIFECYCLE_STATES.includes(record.status) ? record.status : 'active',
    consecutiveMissing: Number.isFinite(record.consecutiveMissing) ? Math.max(0, record.consecutiveMissing) : 0,
    firstMissingAt: Number.isFinite(record.firstMissingAt) ? record.firstMissingAt : 0,
    lastSeenAt: Number.isFinite(record.lastSeenAt) ? record.lastSeenAt : 0,
    lastObservedRun: Number.isFinite(record.lastObservedRun) ? record.lastObservedRun : runNumber,
    ...(Number.isFinite(record.deprecationAt) ? { deprecationAt: record.deprecationAt } : {}),
    ...(Number.isFinite(record.removedAt) ? { removedAt: record.removedAt } : {}),
    ...(typeof record.reason === 'string' ? { reason: record.reason.slice(0, 256) } : {}),
    observedAt: now,
  }
}

function publicRecord(id, record) {
  return { id, ...record }
}

export function updateLifecycle(previous, beforeModels, advertisedModels, {
  runNumber = 1,
  now = Date.now(),
  removeMissing = false,
  staleGraceRuns = DEFAULT_STALE_GRACE_RUNS,
  lifecycleRetentionRuns = DEFAULT_LIFECYCLE_RETENTION_RUNS,
} = {}) {
  const before = Array.isArray(beforeModels) ? beforeModels : []
  const advertised = Array.isArray(advertisedModels) ? advertisedModels : []
  const advertisedIds = new Set(advertised.map((row) => row?.id).filter(Boolean))
  const result = structuredClone(previous && typeof previous === 'object' ? previous : {})
  const changes = []
  const removedIds = []
  for (const model of advertised) {
    const id = model?.id
    if (!id) continue
    const previousRecord = result[id]
    const record = recordOf(previousRecord, runNumber, now)
    const signal = explicitLifecycle(model, now)
    record.status = signal.deprecated ? 'deprecated' : 'active'
    record.consecutiveMissing = 0
    record.firstMissingAt = 0
    record.lastSeenAt = now
    record.lastObservedRun = runNumber
    if (signal.deprecationAt !== undefined) record.deprecationAt = signal.deprecationAt
    else delete record.deprecationAt
    delete record.removedAt
    delete record.reason
    if (previousRecord?.status !== record.status) changes.push({ id, before: previousRecord?.status ?? 'active', after: record.status })
    result[id] = record
  }
  for (const model of before) {
    const id = model?.id
    if (!id || advertisedIds.has(id)) continue
    const previousRecord = result[id]
    const record = recordOf(previousRecord, runNumber, now)
    if (record.status === 'removed') continue
    record.consecutiveMissing += 1
    record.firstMissingAt ||= now
    record.lastObservedRun = runNumber
    if (record.status !== 'deprecated') record.status = 'stale'
    if (removeMissing && record.status === 'stale' && record.consecutiveMissing >= staleGraceRuns) {
      record.status = 'removed'
      record.removedAt = now
      record.reason = `missing for ${record.consecutiveMissing} discovery runs`
      removedIds.push(id)
    }
    if (previousRecord?.status !== record.status || previousRecord?.consecutiveMissing !== record.consecutiveMissing) {
      changes.push({ id, before: previousRecord?.status ?? 'active', after: record.status, consecutiveMissing: record.consecutiveMissing })
    }
    result[id] = record
  }
  for (const [id, record] of Object.entries(result)) {
    if (record.status === 'removed' && Number.isFinite(record.removedAt) && runNumber - (record.lastObservedRun ?? runNumber) >= lifecycleRetentionRuns) {
      delete result[id]
    }
  }
  return {
    records: result,
    changes,
    removedIds,
    statuses: Object.entries(result).map(([id, record]) => publicRecord(id, record)).sort((left, right) => left.id.localeCompare(right.id)),
  }
}

export function lifecycleStatus(records, provider, models) {
  const map = records?.[provider] && typeof records[provider] === 'object' ? records[provider] : {}
  return (models ?? []).map((model) => ({
    ...model,
    lifecycleStatus: map[model.id]?.status ?? 'active',
    lifecycleMissingRuns: map[model.id]?.consecutiveMissing ?? 0,
  }))
}

export function selectableModels(records, provider, models) {
  return lifecycleStatus(records, provider, models).filter((model) => model.lifecycleStatus === 'active')
}
