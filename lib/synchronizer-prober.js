export function createModelProber({ health, getProviderCatalog = () => [] } = {}) {
  const modelProbes = new Map()

  async function tryModel({ provider, model } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (typeof model !== 'string' || !model) throw new Error('model is required')
    const start = Date.now()
    const result = await health({ provider })
    const entry = result?.results?.find((r) => r.provider === provider)
    const providerOk = entry?.status === 'ok'

    // Verify model in provider catalog if catalog is available
    const catalog = typeof getProviderCatalog === 'function' ? getProviderCatalog(provider) : []
    const hasCatalog = Array.isArray(catalog) && catalog.length > 0
    const inCatalog = !hasCatalog || catalog.some((m) => (typeof m === 'string' ? m : m?.id) === model)

    const ok = Boolean(providerOk && inCatalog)
    const latencyMs = Date.now() - start
    const status = !providerOk ? (entry?.status ?? 'error') : (!inCatalog ? 'model_not_found' : 'ok')
    const errorMsg = !providerOk
      ? (entry?.message || entry?.status || 'probe failed')
      : (!inCatalog ? `model "${model}" not found in provider catalog` : undefined)

    const probeResult = {
      provider,
      model,
      ok,
      latencyMs,
      status,
      ...(errorMsg ? { error: errorMsg } : {}),
    }

    modelProbes.set(`${provider}:${model}`, {
      latencyMs,
      ok,
      status,
      timestamp: Date.now(),
    })

    return probeResult
  }

  async function batchTryModels({ provider, models } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (!Array.isArray(models)) throw new Error('models must be an array')
    const list = [...new Set(models.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim()))].slice(0, 50)

    // Probe provider health ONCE for the entire batch rather than per-model
    const start = Date.now()
    const healthResult = await health({ provider })
    const entry = healthResult?.results?.find((r) => r.provider === provider)
    const providerOk = entry?.status === 'ok'
    const catalog = typeof getProviderCatalog === 'function' ? getProviderCatalog(provider) : []
    const hasCatalog = Array.isArray(catalog) && catalog.length > 0
    const baseLatency = Date.now() - start

    const results = []
    const concurrency = 5
    for (let i = 0; i < list.length; i += concurrency) {
      const chunk = list.slice(i, i + concurrency)
      const chunkResults = chunk.map((model) => {
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
      results.push(...chunkResults)
    }

    const reachable = results.filter((r) => r.ok).length
    return {
      provider,
      results,
      summary: { total: results.length, reachable, unreachable: results.length - reachable }
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
