export function createModelProber({
  health,
  getProviderCatalog = () => [],
  probeModel,
  inferModel,
} = {}) {
  const modelProbes = new Map()
  const probeFn = probeModel ?? inferModel

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
        status: 'model_not_found',
        error: `model "${model}" not found in provider catalog`,
      }
      modelProbes.set(`${provider}:${model}`, {
        latencyMs: 0,
        ok: false,
        status: 'model_not_found',
        timestamp: Date.now(),
      })
      return probeResult
    }

    const start = Date.now()
    if (typeof probeFn === 'function') {
      try {
        const probeRes = await probeFn({ provider, model, signal })
        const latencyMs = Math.max(1, Date.now() - start)
        const isOk = probeRes?.ok !== false
        const status = isOk ? 'ok' : (probeRes?.status || 'error')
        const errorMsg = isOk ? undefined : (probeRes?.error || 'inference probe failed')
        const probeResult = {
          provider,
          model,
          ok: isOk,
          latencyMs,
          status,
          ...(errorMsg ? { error: errorMsg } : {}),
        }
        modelProbes.set(`${provider}:${model}`, {
          latencyMs,
          ok: isOk,
          status,
          timestamp: Date.now(),
        })
        return probeResult
      } catch (err) {
        const latencyMs = Math.max(1, Date.now() - start)
        const status = err?.status ? `http_${err.status}` : (err?.code || 'error')
        const probeResult = {
          provider,
          model,
          ok: false,
          latencyMs,
          status,
          error: err?.message || 'inference probe failed',
        }
        modelProbes.set(`${provider}:${model}`, {
          latencyMs,
          ok: false,
          status,
          timestamp: Date.now(),
        })
        return probeResult
      }
    }

    // Fallback if no probeFn provided: check provider health
    const healthResult = await health?.({ provider, model, signal })
    const entry = healthResult?.results?.find((r) => r.provider === provider)
    const providerOk = entry?.status === 'ok'
    const latencyMs = Math.max(1, Date.now() - start)
    const status = !providerOk ? (entry?.status ?? 'error') : 'ok'
    const errorMsg = !providerOk ? (entry?.message || entry?.status || 'probe failed') : undefined

    const probeResult = {
      provider,
      model,
      ok: providerOk,
      latencyMs,
      status,
      ...(errorMsg ? { error: errorMsg } : {}),
    }

    modelProbes.set(`${provider}:${model}`, {
      latencyMs,
      ok: providerOk,
      status,
      timestamp: Date.now(),
    })

    return probeResult
  }

  async function batchTryModels({ provider, models, signal, concurrency = 4 } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (!Array.isArray(models)) throw new Error('models must be an array')
    const list = [...new Set(models.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim()))].slice(0, 50)

    if (typeof probeFn === 'function') {
      // Execute true model-specific probes with bounded concurrency
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

    // If no probeFn provided, use provider health once (backwards compatibility)
    const start = Date.now()
    const healthResult = await health?.({ provider, signal })
    const entry = healthResult?.results?.find((r) => r.provider === provider)
    const providerOk = entry?.status === 'ok'
    const catalog = typeof getProviderCatalog === 'function' ? getProviderCatalog(provider) : []
    const hasCatalog = Array.isArray(catalog) && catalog.length > 0
    const baseLatency = Math.max(1, Date.now() - start)

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
        status,
        ...(errorMsg ? { error: errorMsg } : {}),
      }

      modelProbes.set(`${provider}:${model}`, {
        latencyMs: baseLatency,
        ok,
        status,
        timestamp: Date.now(),
      })

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

  return {
    tryModel,
    batchTryModels,
    getModelProbes,
  }
}