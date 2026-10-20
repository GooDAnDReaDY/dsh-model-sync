export function normalizeOllamaURL(url) {
  let base = typeof url === 'string' && url.trim() ? url.trim() : 'http://127.0.0.1:11434'
  base = base.replace(/\/+$/, '')
  if (base.endsWith('/v1')) base = base.slice(0, -3)
  return base
}

export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)
  return `${val} ${units[i]}`
}

export function createOllamaManager({ fetchImpl = globalThis.fetch } = {}) {
  const activePulls = new Map()
  const pullControllers = new Map()

  async function fetchOllamaPs({ baseURL, signal, timeoutMs = 5000 } = {}) {
    const base = normalizeOllamaURL(baseURL)
    const url = `${base}/api/ps`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    if (signal) signal.addEventListener('abort', () => controller.abort())

    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        return { ok: false, running: [], status: res.status, error: `HTTP ${res.status}` }
      }
      const data = await res.json()
      const models = Array.isArray(data?.models) ? data.models : []
      const running = models.map((m) => {
        const sizeVram = m.size_vram || 0
        const sizeTotal = m.size || 0
        return {
          name: m.name || m.model || '',
          model: m.model || m.name || '',
          size: sizeTotal,
          sizeFormatted: formatBytes(sizeTotal),
          sizeVram,
          sizeVramFormatted: formatBytes(sizeVram),
          expiresAt: m.expires_at || null,
          details: {
            format: m.details?.format || 'gguf',
            family: m.details?.family || '',
            families: m.details?.families || [],
            parameterSize: m.details?.parameter_size || '',
            quantizationLevel: m.details?.quantization_level || '',
          },
        }
      })
      return { ok: true, running }
    } catch (err) {
      clearTimeout(timer)
      return { ok: false, running: [], error: err?.message || String(err) }
    }
  }

  async function fetchOllamaTags({ baseURL, signal, timeoutMs = 5000 } = {}) {
    const base = normalizeOllamaURL(baseURL)
    const url = `${base}/api/tags`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    if (signal) signal.addEventListener('abort', () => controller.abort())

    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        return { ok: false, models: [], status: res.status, error: `HTTP ${res.status}` }
      }
      const data = await res.json()
      const models = (Array.isArray(data?.models) ? data.models : []).map((m) => ({
        name: m.name || m.model || '',
        model: m.model || m.name || '',
        modifiedAt: m.modified_at || '',
        size: m.size || 0,
        sizeFormatted: formatBytes(m.size || 0),
        digest: m.digest || '',
        details: {
          format: m.details?.format || 'gguf',
          family: m.details?.family || '',
          families: m.details?.families || [],
          parameterSize: m.details?.parameter_size || '',
          quantizationLevel: m.details?.quantization_level || '',
        },
      }))
      return { ok: true, models }
    } catch (err) {
      clearTimeout(timer)
      return { ok: false, models: [], error: err?.message || String(err) }
    }
  }

  async function fetchOllamaModelInfo({ model, baseURL, signal, timeoutMs = 5000 } = {}) {
    if (!model || typeof model !== 'string') throw new Error('model is required')
    const base = normalizeOllamaURL(baseURL)
    const url = `${base}/api/show`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    if (signal) signal.addEventListener('abort', () => controller.abort())

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` }
      }
      const data = await res.json()
      const modelInfo = data?.model_info || {}
      let contextWindow = 4096
      for (const [k, v] of Object.entries(modelInfo)) {
        if (k.endsWith('.context_length') && typeof v === 'number') {
          contextWindow = v
          break
        }
      }
      return {
        ok: true,
        model,
        details: data?.details || {},
        parameters: data?.parameters || '',
        template: data?.template || '',
        modelfile: data?.modelfile || '',
        contextWindow,
      }
    } catch (err) {
      clearTimeout(timer)
      return { ok: false, model, error: err?.message || String(err) }
    }
  }

  async function unloadOllamaModel({ model, baseURL, signal, timeoutMs = 5000 } = {}) {
    if (!model || typeof model !== 'string') throw new Error('model is required')
    const base = normalizeOllamaURL(baseURL)
    const url = `${base}/api/generate`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    if (signal) signal.addEventListener('abort', () => controller.abort())

    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ model, keep_alive: 0 }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` }
      }
      return { ok: true, unloaded: model, message: `Model "${model}" unloaded from VRAM` }
    } catch (err) {
      clearTimeout(timer)
      return { ok: false, model, error: err?.message || String(err) }
    }
  }

  async function deleteOllamaModel({ model, baseURL, signal, timeoutMs = 5000 } = {}) {
    if (!model || typeof model !== 'string') throw new Error('model is required')
    const base = normalizeOllamaURL(baseURL)
    const url = `${base}/api/delete`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    if (signal) signal.addEventListener('abort', () => controller.abort())

    try {
      const res = await fetchImpl(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` }
      }
      return { ok: true, deleted: model, message: `Model "${model}" deleted` }
    } catch (err) {
      clearTimeout(timer)
      return { ok: false, model, error: err?.message || String(err) }
    }
  }

  function startOllamaPull({ model, baseURL } = {}) {
    if (!model || typeof model !== 'string') throw new Error('model is required')
    const cleanModel = model.trim()
    const base = normalizeOllamaURL(baseURL)

    const existing = activePulls.get(cleanModel)
    if (existing && !existing.done) {
      return { started: false, alreadyRunning: true, status: existing }
    }

    const state = {
      model: cleanModel,
      baseURL: base,
      status: 'starting',
      completed: 0,
      total: 0,
      percent: 0,
      completedFormatted: '0 B',
      totalFormatted: '0 B',
      done: false,
      error: null,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }

    activePulls.set(cleanModel, state)
    const controller = new AbortController()
    pullControllers.set(cleanModel, controller)

    // Execute streaming pull in background
    ;(async () => {
      try {
        const res = await fetchImpl(`${base}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cleanModel, stream: true }),
          signal: controller.signal,
        })

        if (!res.ok) {
          state.done = true
          state.error = `HTTP ${res.status}`
          state.status = 'error'
          state.updatedAt = Date.now()
          return
        }

        if (res.body && typeof res.body.getReader === 'function') {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                const chunk = JSON.parse(trimmed)
                if (chunk.status) state.status = chunk.status
                if (typeof chunk.completed === 'number') state.completed = chunk.completed
                if (typeof chunk.total === 'number') state.total = chunk.total
                if (state.total > 0) {
                  state.percent = Math.min(100, Math.round((state.completed / state.total) * 100))
                }
                state.completedFormatted = formatBytes(state.completed)
                state.totalFormatted = formatBytes(state.total)
                state.updatedAt = Date.now()
              } catch {
                // Ignore parse errors on partial stream lines
              }
            }
          }
        }

        state.done = true
        state.status = 'success'
        state.percent = 100
        state.updatedAt = Date.now()
      } catch (err) {
        state.done = true
        state.status = 'error'
        state.error = err?.message || String(err)
        state.updatedAt = Date.now()
      } finally {
        pullControllers.delete(cleanModel)
      }
    })()

    return { started: true, status: state }
  }

  function getOllamaPullStatus(model) {
    if (model) return activePulls.get(model) || null
    return Object.fromEntries(activePulls.entries())
  }

  function cancelOllamaPull(model) {
    if (!model) return false
    const ctrl = pullControllers.get(model)
    if (ctrl) {
      ctrl.abort()
      pullControllers.delete(model)
      const st = activePulls.get(model)
      if (st) {
        st.done = true
        st.status = 'cancelled'
        st.updatedAt = Date.now()
      }
      return true
    }
    return false
  }

  return {
    fetchOllamaPs,
    fetchOllamaTags,
    fetchOllamaModelInfo,
    unloadOllamaModel,
    deleteOllamaModel,
    startOllamaPull,
    getOllamaPullStatus,
    cancelOllamaPull,
  }
}