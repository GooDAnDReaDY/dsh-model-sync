const SPARKLINE_BARS = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█']

export function generateSparkline(values) {
  if (!Array.isArray(values) || values.length === 0) return ''
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) return ''
  if (nums.length === 1) return '▄'
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (min === max) return '▄'.repeat(nums.length)
  const range = max - min
  return nums
    .map((v) => {
      const idx = Math.min(7, Math.max(0, Math.floor(((v - min) / range) * 7)))
      return SPARKLINE_BARS[idx]
    })
    .join('')
}

export function classifySpeedTier(latencyMs, isOk = true) {
  if (!isOk) return 'degraded'
  if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs <= 0) return 'unknown'
  if (latencyMs < 300) return 'lightning'
  if (latencyMs < 1200) return 'fast'
  if (latencyMs <= 3000) return 'moderate'
  return 'slow'
}

export function createModelProber({
  health,
  getProviderCatalog = () => [],
  probeModel,
  inferModel,
} = {}) {
  const modelProbes = new Map()
  const latencyHistory = new Map()
  const probeFn = probeModel ?? inferModel

  function recordLatencyEntry(provider, model, { latencyMs, ttftMs, ok, status, error }) {
    const key = `${provider}:${model}`
    modelProbes.set(key, {
      latencyMs,
      ttftMs,
      ok,
      status,
      timestamp: Date.now(),
    })

    const hist = latencyHistory.get(key) || []
    hist.push({
      timestamp: Date.now(),
      latencyMs,
      ttftMs,
      ok,
      status,
      ...(error ? { error } : {}),
    })
    if (hist.length > 10) hist.shift()
    latencyHistory.set(key, hist)
  }

  async function tryModel({ provider, model, signal } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (typeof model !== 'string' || !model) throw new Error('model is required')

    // Verify model in provider catalog if catalog is available
    const catalog = typeof getProviderCatalog === 'function' ? getProviderCatalog(provider) : []
    const hasCatalog = Array.isArray(catalog) && catalog.length > 0
    const inCatalog = !hasCatalog || catalog.some((m) => (typeof m === 'string' ? m : m?.id) === model)
    if (hasCatalog && !inCatalog) {
      const probeResult = {
        provider,
        model,
        ok: false,
        latencyMs: 0,
        ttftMs: 0,
        status: 'model_not_found',
        error: `model "${model}" not found in provider catalog`,
      }
      recordLatencyEntry(provider, model, probeResult)
      return probeResult
    }

    const start = Date.now()
    if (typeof probeFn === 'function') {
      try {
        const probeRes = await probeFn({ provider, model, signal })
        const latencyMs = Math.max(1, Date.now() - start)
        const ttftMs = typeof probeRes?.ttftMs === 'number'
          ? probeRes.ttftMs
          : (typeof probeRes?.metrics?.ttft === 'number' ? probeRes.metrics.ttft : Math.round(latencyMs * 0.45))
        const isOk = probeRes?.ok !== false
        const status = isOk ? 'ok' : (probeRes?.status || 'error')
        const errorMsg = isOk ? undefined : (probeRes?.error || 'inference probe failed')
        const probeResult = {
          provider,
          model,
          ok: isOk,
          latencyMs,
          ttftMs,
          status,
          ...(errorMsg ? { error: errorMsg } : {}),
        }
        recordLatencyEntry(provider, model, probeResult)
        return probeResult
      } catch (err) {
        const latencyMs = Math.max(1, Date.now() - start)
        const ttftMs = Math.round(latencyMs * 0.45)
        const status = err?.status ? `http_${err.status}` : (err?.code || 'error')
        const probeResult = {
          provider,
          model,
          ok: false,
          latencyMs,
          ttftMs,
          status,
          error: err?.message || 'inference probe failed',
        }
        recordLatencyEntry(provider, model, probeResult)
        return probeResult
      }
    }

    // Fallback if no probeFn provided: check provider health
    const healthResult = await health?.({ provider, model, signal })
    const entry = healthResult?.results?.find((r) => r.provider === provider)
    const providerOk = entry?.status === 'ok'
    const latencyMs = Math.max(1, Date.now() - start)
    const ttftMs = Math.round(latencyMs * 0.45)
    const status = !providerOk ? (entry?.status ?? 'error') : 'ok'
    const errorMsg = !providerOk ? (entry?.message || entry?.status || 'probe failed') : undefined

    const probeResult = {
      provider,
      model,
      ok: providerOk,
      latencyMs,
      ttftMs,
      status,
      ...(errorMsg ? { error: errorMsg } : {}),
    }

    recordLatencyEntry(provider, model, probeResult)
    return probeResult
  }

  async function batchTryModels({ provider, models, signal, concurrency = 4 } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (!Array.isArray(models)) throw new Error('models must be an array')
    const list = [...new Set(models.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim()))].slice(0, 50)

    if (typeof probeFn === 'function') {
      const limit = Math.max(1, Math.min(10, Math.floor(Number(concurrency) || 4)))
      const results = new Array(list.length)
      let cursor = 0

      await Promise.all(Array.from({ length: Math.min(limit, list.length || 1) }, async () => {
        while (cursor < list.length) {
          if (signal?.aborted) break
          const index = cursor++
          results[index] = await tryModel({ provider, model: list[index], signal })
        }
      }))

      const reachable = results.filter((r) => r?.ok).length
      return {
        provider,
        results,
        summary: { total: results.length, reachable, unreachable: results.length - reachable },
      }
    }

    const start = Date.now()
    const healthResult = await health?.({ provider, signal })
    const entry = healthResult?.results?.find((r) => r.provider === provider)
    const providerOk = entry?.status === 'ok'
    const catalog = typeof getProviderCatalog === 'function' ? getProviderCatalog(provider) : []
    const hasCatalog = Array.isArray(catalog) && catalog.length > 0
    const baseLatency = Math.max(1, Date.now() - start)
    const ttftMs = Math.round(baseLatency * 0.45)

    const results = list.map((model) => {
      const inCatalog = !hasCatalog || catalog.some((m) => (typeof m === 'string' ? m : m?.id) === model)
      const ok = Boolean(providerOk && inCatalog)
      const status = !providerOk ? (entry?.status ?? 'error') : (!inCatalog ? 'model_not_found' : 'ok')
      const errorMsg = !providerOk
        ? (entry?.message || entry?.status || 'probe failed')
        : (!inCatalog ? `model "${model}" not found in provider catalog` : undefined)

      const itemResult = {
        provider,
        model,
        ok,
        latencyMs: baseLatency,
        ttftMs,
        status,
        ...(errorMsg ? { error: errorMsg } : {}),
      }

      recordLatencyEntry(provider, model, itemResult)
      return itemResult
    })

    const reachable = results.filter((r) => r.ok).length
    return {
      provider,
      results,
      summary: { total: results.length, reachable, unreachable: results.length - reachable },
    }
  }

  function getModelProbes() {
    return Object.fromEntries(modelProbes)
  }

  function getLatencyHistory(provider, model) {
    if (provider && model) {
      return latencyHistory.get(`${provider}:${model}`) || []
    }
    return Object.fromEntries(latencyHistory)
  }

  function getLatencyRadar({ provider } = {}) {
    const radar = []
    for (const [key, hist] of latencyHistory.entries()) {
      if (!Array.isArray(hist) || hist.length === 0) continue
      const [entryProv, ...rest] = key.split(':')
      const entryModel = rest.join(':')
      if (provider && entryProv !== provider) continue

      const latest = hist[hist.length - 1]
      const latencies = hist.map((h) => h.latencyMs)
      const avgLatencyMs = Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length)
      const sorted = [...latencies].sort((a, b) => a - b)
      const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
      const p95LatencyMs = sorted[p95Idx]
      const sparkline = generateSparkline(latencies)
      const tier = classifySpeedTier(latest.latencyMs, latest.ok)

      radar.push({
        provider: entryProv,
        model: entryModel,
        latencyMs: latest.latencyMs,
        ttftMs: latest.ttftMs,
        avgLatencyMs,
        p95LatencyMs,
        tier,
        sparkline,
        history: latencies,
        ok: latest.ok,
        status: latest.status,
        lastChecked: latest.timestamp,
      })
    }

    return {
      updatedAt: Date.now(),
      radar,
    }
  }

  return {
    tryModel,
    batchTryModels,
    getModelProbes,
    getLatencyHistory,
    getLatencyRadar,
  }
}
