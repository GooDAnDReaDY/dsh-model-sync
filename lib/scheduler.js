export function createSyncScheduler(sync, { getConfig = () => ({}), setIntervalFn = setInterval, clearIntervalFn = clearInterval, logger = console } = {}) {
  let timer = null
  let running = false

  function stop() {
    if (timer !== null) clearIntervalFn(timer)
    timer = null
    running = false
  }

  function start() {
    stop()
    const config = getConfig() ?? {}
    const minutes = Number(config.intervalMinutes)
    if (config.enabled === false || !Number.isFinite(minutes) || minutes <= 0) return false
    const period = Math.max(1, minutes) * 60_000
    timer = setIntervalFn(async () => {
      if (running) return
      running = true
      try {
        await sync.run({ dryRun: config.autoApply !== true })
      } catch (error) {
        logger.warn?.(`[dsh-model-sync] scheduled run failed: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        running = false
      }
    }, period)
    return true
  }

  return Object.freeze({
    start,
    stop,
    reconfigure: start,
    status: () => ({ active: timer !== null, running }),
  })
}
