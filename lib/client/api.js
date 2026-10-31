// Client HTTP API helpers and typed endpoint wrappers for @goodandready/dsh-model-sync (#279)

export const API = '/dsh-model-sync'

export async function safeJson(r) {
  const text = await r.text()
  if (!text || !text.trim()) {
    if (!r.ok) throw new Error(`HTTP ${r.status}${r.statusText ? ': ' + r.statusText : ''}`)
    return {}
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    if (!r.ok) throw new Error(`HTTP ${r.status}${text ? ': ' + text.slice(0, 120) : ''}`)
    throw new Error(`Invalid JSON response (HTTP ${r.status})`)
  }
  if (!r.ok) {
    throw new Error(parsed?.error?.message ?? parsed?.message ?? `HTTP ${r.status}`)
  }
  return parsed
}

export function createModelSyncApiClient({ fetchImpl = typeof fetch === 'function' ? fetch : null, baseUrl = API } = {}) {
  const req = async (subpath, init) => {
    if (typeof fetchImpl !== 'function') throw new Error('fetch is not available')
    const res = await fetchImpl(`${baseUrl}${subpath}`, init)
    return safeJson(res)
  }
  const postJson = (subpath, body, extraHeaders = {}) =>
    req(subpath, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body ?? {}),
    })

  return Object.freeze({
    baseUrl,
    getStatus: () => req('/status'),
    discover: (provider) => postJson('/discover', provider ? { provider } : {}),
    runSync: (payload) => postJson('/run', payload),
    checkHealth: (provider) => postJson('/health', provider ? { provider } : {}),
    setSelection: (provider, models) => postJson('/selection', { provider, models }),
    setPolicy: (provider, policy) => postJson('/policy', { provider, policy }),
    getCredentials: () => req('/credentials'),
    getHistory: () => req('/history'),
    rollbackHistory: (historyId, provider) => postJson('/history/rollback', { historyId, provider }),
    getNotifications: () => req('/notifications'),
    updateNotification: (id, action) => postJson('/notifications/update', { id, action }),
    getAliases: () => req('/aliases'),
    resolveAlias: (alias) => postJson('/aliases/resolve', { alias }),
    setAlias: (payload) => postJson('/aliases', payload),
    deleteAlias: (alias) => postJson('/aliases/delete', { alias }),
    tryModel: (provider, model) => postJson('/try', { provider, model }),
    batchTryModels: (provider, models) => postJson('/batch-try', { provider, models }),
    syncPricing: () => postJson('/pricing/sync', {}),
    probeCapabilities: (payload) => postJson('/capabilities/probe', payload),
    getOllamaStatus: () => req('/ollama/status'),
    pullOllamaModel: (model) => postJson('/ollama/pull', { model }),
    unloadOllamaModel: (model) => postJson('/ollama/unload', { model }),
    deleteOllamaModel: (model) => postJson('/ollama/delete', { model }),
    exportConfig: () => req('/export'),
    importConfig: (data) => postJson('/import', { data }),
    testWebhook: (payload) => postJson('/webhook/test', payload),
    checkUpdate: () => req('/update?fresh=1'),
    runUpdate: () => postJson('/update', {}, { 'x-dsh-plugin-update': '1' }),
  })
}
