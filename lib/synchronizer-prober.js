export function createModelProber({ health }) {
  async function tryModel({ provider, model } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (typeof model !== 'string' || !model) throw new Error('model is required')
    const start = Date.now()
    const result = await health({ provider })
    const entry = result?.results?.find((r) => r.provider === provider)
    return {
      provider,
      model,
      ok: entry?.status === 'ok',
      latencyMs: Date.now() - start,
      status: entry?.status ?? 'unknown',
      ...(entry?.status !== 'ok' ? { error: entry?.message || entry?.status || 'probe failed' } : {}),
    }
  }

  async function batchTryModels({ provider, models } = {}) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (!Array.isArray(models)) throw new Error('models must be an array')
    const list = [...new Set(models.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim()))].slice(0, 50)
    const results = []
    const concurrency = 3
    for (let i = 0; i < list.length; i += concurrency) {
      const chunk = list.slice(i, i + concurrency)
      const chunkResults = await Promise.all(
        chunk.map((model) => tryModel({ provider, model }).catch((err) => ({
          provider,
          model,
          ok: false,
          latencyMs: 0,
          status: 'error',
          error: err instanceof Error ? err.message : String(err)
        })))
      )
      results.push(...chunkResults)
    }
    const reachable = results.filter((r) => r.ok).length
    return {
      provider,
      results,
      summary: { total: results.length, reachable, unreachable: results.length - reachable }
    }
  }

  return {
    tryModel,
    batchTryModels,
  }
}
