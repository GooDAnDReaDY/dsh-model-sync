function minutes(value, fallback = 60) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(10080, Math.max(1, number))
}

function optionalMinutes(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(10080, Math.max(1, number))
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function createSyncScheduler(sync, {
  getConfig = () => ({}),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logger = console,
  randomFn = Math.random,
  nowFn = () => Date.now(),
} = {}) {
  let timer = null
  let running = false
  const state = new Map()

  function stop() {
    if (timer !== null) clearIntervalFn(timer)
    timer = null
    running = false
  }

  function inventory(config) {
    if (typeof sync.listProviders === 'function') {
      const rows = sync.listProviders().filter((row) => row?.configured && row.provider)
      const configured = Array.isArray(config.providers) ? new Map(config.providers.map((row) => [row.provider, row])) : null
      return rows
        .filter((row) => !configured || configured.size === 0 || configured.get(row.provider)?.enabled !== false)
        .map((row) => ({ ...row, ...(configured?.get(row.provider) ?? {}) }))
    }
    return null
  }

  function scheduleRows(config) {
    const rows = inventory(config)
    if (rows === null) return [{ provider: undefined, enabled: true }]
    return rows
  }

  function timing(row, config) {
    const interval = optionalMinutes(row.intervalMinutes, minutes(config.intervalMinutes, 60))
    const ttl = optionalMinutes(row.ttlMinutes, optionalMinutes(config.ttlMinutes, 0))
    const jitter = optionalMinutes(row.jitterMinutes, optionalMinutes(config.jitterMinutes, 0))
    return { interval, ttl, jitter }
  }

  function delayMs(timingValue) {
    const jitter = timingValue.jitter > 0 ? randomFn() * timingValue.jitter : 0
    return Math.max(60_000, (Math.max(timingValue.interval, timingValue.ttl) + jitter) * 60_000)
  }

  function ensureState(row, config, now) {
    const key = row.provider ?? '*'
    const existing = state.get(key)
    if (existing) return existing
    const nextAt = now
    const created = { provider: row.provider, nextAt, lastRunAt: null, lastStatus: null, lastError: null }
    state.set(key, created)
    return created
  }

  function resetStates(config) {
    const rows = scheduleRows(config)
    const active = new Set(rows.map((row) => row.provider ?? '*'))
    for (const key of state.keys()) if (!active.has(key)) state.delete(key)
    const now = nowFn()
    for (const row of rows) ensureState(row, config, now)
  }

  async function tick() {
    const config = getConfig() ?? {}
    if (config.enabled === false || config.scheduleEnabled === false || running) return
    const rows = scheduleRows(config)
    if (rows.length === 0) return
    const now = nowFn()
    const due = rows.filter((row) => now >= ensureState(row, config, now).nextAt)
    if (due.length === 0) return
    running = true
    try {
      for (const row of due) {
        const item = ensureState(row, config, nowFn())
        const options = { dryRun: config.autoApply === true ? false : true }
        if (row.provider) options.provider = row.provider
        item.lastRunAt = nowFn()
        try {
          const result = await sync.run(options)
          item.lastStatus = result?.results?.find((entry) => entry.provider === row.provider)?.status ?? 'ok'
          item.lastError = null
        } catch (error) {
          item.lastStatus = 'error'
          item.lastError = errorMessage(error)
          logger.warn?.(`[dsh-model-sync] scheduled run failed${row.provider ? ` for ${row.provider}` : ''}: ${item.lastError}`)
        } finally {
          item.nextAt = nowFn() + delayMs(timing(row, config))
        }
      }
    } finally {
      running = false
    }
  }

  function start() {
    stop()
    const config = getConfig() ?? {}
    if (config.enabled === false || config.scheduleEnabled === false) return false
    const rows = scheduleRows(config)
    if (inventory(config) !== null && rows.length === 0) return false
    resetStates(config)
    // One-minute polling is the lower safety bound. Per-provider intervals,
    // TTLs, and jitter are enforced by tick without multiplying timers.
    timer = setIntervalFn(() => tick(), 60_000)
    return true
  }

  function status() {
    const config = getConfig() ?? {}
    resetStates(config)
    const values = [...state.values()]
    const nextAt = values.length > 0 ? Math.min(...values.map((row) => row.nextAt)) : null
    const lastRunAt = values.filter((row) => row.lastRunAt).reduce((max, row) => Math.max(max, row.lastRunAt), 0) || null
    return {
      active: timer !== null,
      running,
      lastRunAt,
      nextRunAt: nextAt,
      providers: Object.fromEntries(values.map((row) => [row.provider ?? '*', { lastRunAt: row.lastRunAt, nextRunAt: row.nextAt, lastStatus: row.lastStatus, ...(row.lastError ? { lastError: row.lastError } : {}) }])),
    }
  }

  return Object.freeze({ start, stop, reconfigure: start, tick, status })
}
