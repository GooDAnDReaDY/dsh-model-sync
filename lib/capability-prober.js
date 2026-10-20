import fs from 'node:fs'
import path from 'node:path'

export const PROBE_TYPES = Object.freeze(['jsonSchema', 'tools', 'vision', 'developerRole'])

export const PROBE_PAYLOADS = Object.freeze({
  jsonSchema: {
    name: 'jsonSchema',
    buildRequest: (model) => ({
      model,
      messages: [{ role: 'user', content: 'Respond with valid JSON {"ok": true}' }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ping_schema',
          strict: true,
          schema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 16,
    }),
    validateResponse: (res) => {
      if (!res) return false
      try {
        const text = typeof res === 'string'
          ? res
          : (res?.choices?.[0]?.message?.content || res?.content || res?.text || '')
        const parsed = typeof text === 'string' ? JSON.parse(text.trim()) : text
        return parsed && parsed.ok === true
      } catch {
        return false
      }
    },
  },
  tools: {
    name: 'tools',
    buildRequest: (model) => ({
      model,
      messages: [{ role: 'user', content: 'Call ping_tool with ping="1"' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'ping_tool',
            description: 'Test ping function',
            parameters: {
              type: 'object',
              properties: { ping: { type: 'string' } },
              required: ['ping'],
            },
          },
        },
      ],
      tool_choice: 'auto',
      max_tokens: 32,
    }),
    validateResponse: (res) => {
      if (!res) return false
      const toolCalls = res?.choices?.[0]?.message?.tool_calls || res?.tool_calls
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        return toolCalls.some((tc) => tc?.function?.name === 'ping_tool')
      }
      return Boolean(res?.choices?.[0]?.message || res?.text || res?.content)
    },
  },
  vision: {
    name: 'vision',
    buildRequest: (model) => ({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe image' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAKey',
              },
            },
          ],
        },
      ],
      max_tokens: 16,
    }),
    validateResponse: (res) => {
      if (!res) return false
      const content = res?.choices?.[0]?.message?.content || res?.text || res?.content || ''
      return Boolean(typeof content === 'string' && content.length > 0)
    },
  },
  developerRole: {
    name: 'developerRole',
    buildRequest: (model) => ({
      model,
      messages: [
        { role: 'developer', content: 'You are a test probe assistant.' },
        { role: 'user', content: 'Say OK' },
      ],
      max_tokens: 16,
    }),
    validateResponse: (res) => {
      if (!res) return false
      const content = res?.choices?.[0]?.message?.content || res?.text || res?.content || ''
      return Boolean(typeof content === 'string' && content.length > 0)
    },
  },
})

export function createCapabilityProber({
  inferFn,
  getCatalog = () => [],
  storagePath,
} = {}) {
  const verifiedMap = new Map()
  let isProbing = false
  let probingProgress = {
    total: 0,
    completed: 0,
    currentProvider: '',
    currentModel: '',
    startedAt: 0,
  }

  function loadFromDisk() {
    if (!storagePath) return
    try {
      if (fs.existsSync(storagePath)) {
        const raw = fs.readFileSync(storagePath, 'utf8')
        const data = JSON.parse(raw)
        if (data && typeof data === 'object') {
          for (const [k, v] of Object.entries(data)) {
            verifiedMap.set(k, v)
          }
        }
      }
    } catch {
      // Ignore disk load error
    }
  }

  function saveToDisk() {
    if (!storagePath) return
    try {
      const dir = path.dirname(storagePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const obj = Object.fromEntries(verifiedMap.entries())
      fs.writeFileSync(storagePath, JSON.stringify(obj, null, 2), 'utf8')
    } catch {
      // Ignore disk save error
    }
  }

  loadFromDisk()

  async function probeSingleCapability({ provider, model, probeType, signal }) {
    const probeDef = PROBE_PAYLOADS[probeType]
    if (!probeDef) throw new Error(`Unknown probe type: ${probeType}`)

    const start = Date.now()
    if (typeof inferFn !== 'function') {
      return { ok: true, latencyMs: 1, mock: true }
    }

    try {
      const payload = probeDef.buildRequest(model)
      const res = await inferFn({ provider, model, payload, probeType, signal })
      const latencyMs = Math.max(1, Date.now() - start)
      const ok = probeDef.validateResponse(res)
      return { ok, latencyMs }
    } catch (err) {
      const latencyMs = Math.max(1, Date.now() - start)
      return { ok: false, latencyMs, error: err?.message || String(err) }
    }
  }

  async function probeModelCapabilities({ provider, model, probeTypes = PROBE_TYPES, signal } = {}) {
    if (!provider || typeof provider !== 'string') throw new Error('provider is required')
    if (!model || typeof model !== 'string') throw new Error('model is required')

    const details = {}
    const verified = {}

    for (const pType of probeTypes) {
      if (signal?.aborted) break
      const res = await probeSingleCapability({ provider, model, probeType: pType, signal })
      details[pType] = res
      verified[pType] = Boolean(res.ok)
    }

    const key = `${provider}:${model}`
    const record = {
      provider,
      model,
      verified,
      details,
      checkedAt: Date.now(),
    }

    verifiedMap.set(key, record)
    saveToDisk()
    return record
  }

  async function probeProviderCapabilities({ provider, onlyNew = false, concurrency = 2, signal } = {}) {
    if (!provider || typeof provider !== 'string') throw new Error('provider is required')

    const catalog = typeof getCatalog === 'function' ? getCatalog(provider) : []
    const allModels = (Array.isArray(catalog) ? catalog : [])
      .map((m) => (typeof m === 'string' ? m : m?.id))
      .filter((id) => typeof id === 'string' && id.trim())

    const modelsToProbe = onlyNew
      ? allModels.filter((id) => !verifiedMap.has(`${provider}:${id}`))
      : allModels

    isProbing = true
    probingProgress = {
      total: modelsToProbe.length,
      completed: 0,
      currentProvider: provider,
      currentModel: '',
      startedAt: Date.now(),
    }

    const results = []
    const limit = Math.max(1, Math.min(6, Number(concurrency) || 2))
    let cursor = 0

    const workers = Array.from({ length: Math.min(limit, modelsToProbe.length || 1) }, async () => {
      while (cursor < modelsToProbe.length) {
        if (signal?.aborted) break
        const index = cursor++
        const modelId = modelsToProbe[index]
        probingProgress.currentModel = modelId
        const record = await probeModelCapabilities({ provider, model: modelId, signal })
        results.push(record)
        probingProgress.completed++
      }
    })

    await Promise.all(workers)
    isProbing = false

    return {
      provider,
      total: modelsToProbe.length,
      completed: results.length,
      results,
    }
  }

  async function probeAllCapabilities({ onlyNew = false, concurrency = 2, signal } = {}) {
    const catalog = typeof getCatalog === 'function' ? getCatalog() : []
    const providers = Array.isArray(catalog)
      ? [...new Set(catalog.map((m) => m?.provider).filter(Boolean))]
      : []

    isProbing = true
    const allResults = []

    for (const provider of providers) {
      if (signal?.aborted) break
      const provRes = await probeProviderCapabilities({ provider, onlyNew, concurrency, signal })
      allResults.push(provRes)
    }

    isProbing = false
    return {
      providersCount: providers.length,
      results: allResults,
    }
  }

  function getStatus() {
    return {
      isProbing,
      progress: { ...probingProgress },
      totalVerified: verifiedMap.size,
    }
  }

  function getVerifiedCapabilities({ provider, model } = {}) {
    if (provider && model) {
      return verifiedMap.get(`${provider}:${model}`) || null
    }
    if (provider) {
      const prefix = `${provider}:`
      const out = {}
      for (const [k, v] of verifiedMap.entries()) {
        if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v
      }
      return out
    }
    return Object.fromEntries(verifiedMap.entries())
  }

  function setVerifiedCapabilities(provider, model, data) {
    if (!provider || !model || !data) return
    const key = `${provider}:${model}`
    verifiedMap.set(key, {
      provider,
      model,
      verified: data.verified || {},
      details: data.details || {},
      checkedAt: data.checkedAt || Date.now(),
    })
    saveToDisk()
  }

  function clearVerifiedCapabilities({ provider, model } = {}) {
    if (provider && model) {
      verifiedMap.delete(`${provider}:${model}`)
    } else if (provider) {
      const prefix = `${provider}:`
      for (const k of [...verifiedMap.keys()]) {
        if (k.startsWith(prefix)) verifiedMap.delete(k)
      }
    } else {
      verifiedMap.clear()
    }
    saveToDisk()
  }

  return {
    probeModelCapabilities,
    probeProviderCapabilities,
    probeAllCapabilities,
    getStatus,
    getVerifiedCapabilities,
    setVerifiedCapabilities,
    clearVerifiedCapabilities,
  }
}