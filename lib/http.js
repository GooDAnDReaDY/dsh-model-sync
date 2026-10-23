/**
 * DeepSeek Harness Model Sync — HTTP API & Route Dispatcher (#218, #274)
 */

import crypto from 'node:crypto'
import {
  isLoopbackIp,
  trusted,
  getReadRejectionStatus,
  assertAuthorizedRequest,
  writeJson,
} from './access.js'
import {
  readJson,
  normalizeWebhookTestRequest,
  normalizeRunRequest,
  normalizeCredentialRequest,
  normalizeNotificationRequest,
  normalizeNotificationAction,
  normalizeCredentialCheckRequest,
  normalizeTryRequest,
  normalizeBatchTryRequest,
  normalizeAliasRequest,
  normalizeHealthRequest,
  normalizePolicyRequest,
  normalizeHistoryRequest,
  normalizeHistoryRollbackRequest,
  normalizeSelectionRequest,
} from './http-normalizers.js'

export * from './access.js'
export * from './http-normalizers.js'

export function isLoopbackAddress(ip) {
  return isLoopbackIp(ip)
}
const checkLoopback = isLoopbackAddress

const BASE = '/dsh-model-sync'

function json(res, status, body) {
  writeJson(res, status, body)
}

export function registerHttpApi(ctx, synchronizer, { getSchedulerStatus = () => null } = {}) {
  if (typeof ctx?.webServer?.register !== 'function') {
    if (typeof ctx?.logger?.warn === 'function') {
      ctx.logger.warn('[dsh-model-sync] webServer service unavailable, HTTP API skipped')
    }
    return []
  }

  const makeHandler = (route) => async (req, res) => {
    try {
      const isPublicStatus = route === 'status' && req.method === 'GET'
      if (!assertAuthorizedRequest(req, res, ctx, { isPublic: isPublicStatus })) {
        return
      }

      if (route === 'status') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        const payload = { ...synchronizer.status(), scheduler: getSchedulerStatus(), providers: synchronizer.listProviders() }
        const bodyStr = JSON.stringify(payload)
        const etag = 'W/"' + crypto.createHash('sha1').update(bodyStr).digest('hex').slice(0, 16) + '"'
        const clientEtag = req.headers?.['if-none-match']
        if (clientEtag && clientEtag.trim() === etag) {
          res.writeHead(304, { etag })
          return res.end()
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', etag })
        return res.end(bodyStr)
      }

      if (route === 'history') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try { return json(res, 200, { history: synchronizer.history(normalizeHistoryRequest(req.url)) }) }
        catch (error) { return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } }) }
      }

      if (route === 'credentials') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try { return json(res, 200, await synchronizer.credentialDiagnostics(normalizeCredentialRequest(req.url))) }
        catch (error) { return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } }) }
      }

      if (route === 'export') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        return json(res, 200, synchronizer.exportConfig())
      }

      if (route === 'aliases' && req.method === 'GET') {
        return json(res, 200, { aliases: synchronizer.getAliases() })
      }

      if (route === 'aliases-resolve') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const urlObj = new URL(req.url, 'http://127.0.0.1')
          const alias = urlObj.searchParams.get('alias')
          if (!alias) return json(res, 400, { error: { code: 'bad-request', message: 'alias query parameter is required' } })
          return json(res, 200, synchronizer.resolveAlias(alias))
        } catch (error) {
          return json(res, 400, { error: { code: error?.code ?? 'resolve-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'import') {
        if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
        try {
          const body = await readJson(req)
          const result = await synchronizer.importConfig(body)
          return json(res, 200, result)
        } catch (error) {
          const code = error?.code === 'INVALID_CONFIG' || error?.code === 'INVALID_POLICY' ? 400 : 500
          return json(res, code, { error: { code: error?.code ?? 'import-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'report') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        return json(res, 200, { report: synchronizer.report() })
      }

      if (route === 'notifications') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        return json(res, 200, { notifications: synchronizer.notifications(normalizeNotificationRequest(req.url)) })
      }

      if (route === 'health-latency') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const urlObj = new URL(req.url, 'http://127.0.0.1')
          const provider = urlObj.searchParams.get('provider') || undefined
          const report = typeof synchronizer.getLatencyRadar === 'function'
            ? synchronizer.getLatencyRadar({ provider })
            : { updatedAt: Date.now(), radar: [] }
          return json(res, 200, report)
        } catch (error) {
          return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'pricing') {
        if (req.method === 'GET') {
          try {
            const urlObj = new URL(req.url, 'http://127.0.0.1')
            const provider = urlObj.searchParams.get('provider') || undefined
            const model = urlObj.searchParams.get('model') || undefined
            const report = typeof synchronizer.getPricingInfo === 'function'
              ? synchronizer.getPricingInfo({ provider, model })
              : { dynamicCount: 0, sample: {} }
            return json(res, 200, report)
          } catch (error) {
            return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } })
          }
        }
        if (req.method === 'POST') {
          try {
            const result = typeof synchronizer.syncPricing === 'function'
              ? await synchronizer.syncPricing()
              : { updated: 0, source: 'none' }
            return json(res, 200, result)
          } catch (error) {
            return json(res, 500, { error: { code: 'pricing-sync-failed', message: error instanceof Error ? error.message : String(error) } })
          }
        }
        return json(res, 405, { error: { code: 'method', message: 'GET or POST only' } })
      }

      // Capability Probing Endpoints (#263)
      if (route === 'probe-provider') {
        if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
        try {
          const body = await readJson(req)
          if (!body || typeof body.provider !== 'string' || !body.provider.trim()) {
            return json(res, 400, { error: { code: 'bad-request', message: 'provider is required' } })
          }
          const provider = body.provider.trim()
          const concurrency = Number.isInteger(body.concurrency) ? body.concurrency : 3
          const onlyNew = Boolean(body.onlyNew)
          const result = typeof synchronizer.probeCapabilitiesForProvider === 'function'
            ? await synchronizer.probeCapabilitiesForProvider(provider, { concurrency, onlyNew })
            : { ok: false, error: 'prober unavailable' }
          return json(res, 200, result)
        } catch (error) {
          return json(res, 500, { error: { code: 'probe-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'probe-all') {
        if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
        try {
          const body = await readJson(req)
          const concurrency = Number.isInteger(body?.concurrency) ? body.concurrency : 3
          const onlyNew = Boolean(body?.onlyNew)
          const result = typeof synchronizer.probeAllCapabilities === 'function'
            ? await synchronizer.probeAllCapabilities({ concurrency, onlyNew })
            : { ok: false, error: 'prober unavailable' }
          return json(res, 200, result)
        } catch (error) {
          return json(res, 500, { error: { code: 'probe-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'probe-status') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const status = typeof synchronizer.getProbingStatus === 'function'
            ? synchronizer.getProbingStatus()
            : { isProbing: false, progress: { total: 0, completed: 0 } }
          return json(res, 200, status)
        } catch (error) {
          return json(res, 500, { error: { code: 'probe-status-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'probe-verified') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const verified = typeof synchronizer.getVerifiedCapabilities === 'function'
            ? synchronizer.getVerifiedCapabilities()
            : {}
          return json(res, 200, verified)
        } catch (error) {
          return json(res, 500, { error: { code: 'probe-verified-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      // Ollama Hub Endpoints (#268)
      if (route === 'ollama-ps') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const data = typeof synchronizer.ollamaPs === 'function'
            ? await synchronizer.ollamaPs()
            : { ok: false, error: 'ollama unavailable' }
          return json(res, 200, data)
        } catch (error) {
          return json(res, 500, { error: { code: 'ollama-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'ollama-tags') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const data = typeof synchronizer.ollamaTags === 'function'
            ? await synchronizer.ollamaTags()
            : { ok: false, models: [] }
          return json(res, 200, data)
        } catch (error) {
          return json(res, 500, { error: { code: 'ollama-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'ollama-info') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const urlObj = new URL(req.url, 'http://127.0.0.1')
          const model = urlObj.searchParams.get('model') || ''
          const data = typeof synchronizer.ollamaShow === 'function'
            ? await synchronizer.ollamaShow(model)
            : { ok: false, error: 'ollama unavailable' }
          return json(res, 200, data)
        } catch (error) {
          return json(res, 500, { error: { code: 'ollama-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'ollama-pull') {
        if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
        try {
          const body = await readJson(req)
          if (!body || typeof body.model !== 'string' || !body.model.trim()) {
            return json(res, 400, { error: { code: 'bad-request', message: 'model name is required' } })
          }
          const data = typeof synchronizer.ollamaPull === 'function'
            ? await synchronizer.ollamaPull(body.model.trim())
            : { ok: false, error: 'ollama unavailable' }
          return json(res, 200, data)
        } catch (error) {
          return json(res, 500, { error: { code: 'ollama-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'ollama-pull-status') {
        if (req.method !== 'GET') return json(res, 405, { error: { code: 'method', message: 'GET only' } })
        try {
          const urlObj = new URL(req.url, 'http://127.0.0.1')
          const model = urlObj.searchParams.get('model') || ''
          const data = typeof synchronizer.ollamaPullStatus === 'function'
            ? synchronizer.ollamaPullStatus(model)
            : { active: false }
          return json(res, 200, data)
        } catch (error) {
          return json(res, 500, { error: { code: 'ollama-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'ollama-unload') {
        if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
        try {
          const body = await readJson(req)
          if (!body || typeof body.model !== 'string' || !body.model.trim()) {
            return json(res, 400, { error: { code: 'bad-request', message: 'model name is required' } })
          }
          const data = typeof synchronizer.ollamaUnload === 'function'
            ? await synchronizer.ollamaUnload(body.model.trim())
            : { ok: false, error: 'ollama unavailable' }
          return json(res, 200, data)
        } catch (error) {
          return json(res, 500, { error: { code: 'ollama-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (route === 'ollama-delete') {
        if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })
        try {
          const body = await readJson(req)
          if (!body || typeof body.model !== 'string' || !body.model.trim()) {
            return json(res, 400, { error: { code: 'bad-request', message: 'model name is required' } })
          }
          const data = typeof synchronizer.ollamaDelete === 'function'
            ? await synchronizer.ollamaDelete(body.model.trim())
            : { ok: false, error: 'ollama unavailable' }
          return json(res, 200, data)
        } catch (error) {
          return json(res, 500, { error: { code: 'ollama-failed', message: error instanceof Error ? error.message : String(error) } })
        }
      }

      if (req.method !== 'POST') return json(res, 405, { error: { code: 'method', message: 'POST only' } })

      let options
      try {
        const body = await readJson(req)
        options = route === 'selection'
          ? normalizeSelectionRequest(body)
          : route === 'policy' ? normalizePolicyRequest(body)
          : route === 'try' ? normalizeTryRequest(body)
          : route === 'batch-try' ? normalizeBatchTryRequest(body)
          : route === 'aliases' ? normalizeAliasRequest(body)
          : route === 'health' ? normalizeHealthRequest(body)
          : route === 'credentials-check' ? normalizeCredentialCheckRequest(body)
          : route === 'notification-read' || route === 'notification-acknowledge' ? normalizeNotificationAction(body)
          : route === 'webhook-test' ? normalizeWebhookTestRequest(body)
          : route === 'rollback' ? normalizeHistoryRollbackRequest(body)
          : normalizeRunRequest(body)
      } catch (error) {
        return json(res, 400, { error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) } })
      }

      try {
        const result = route === 'selection'
          ? await synchronizer.setModelSelection(options.provider, options.models)
          : route === 'policy' ? await synchronizer.setModelPolicy(options.provider, options.policy)
          : route === 'try' ? await synchronizer.tryModel(options)
          : route === 'batch-try' ? await synchronizer.batchTryModels(options)
          : route === 'aliases' ? (options.action === 'delete' ? await synchronizer.deleteAlias(options) : await synchronizer.setAlias(options))
          : route === 'health' ? await synchronizer.health(options)
          : route === 'credentials-check' ? { health: await synchronizer.health(options), credentials: await synchronizer.credentialDiagnostics(options) }
          : route === 'notification-read' ? await synchronizer.updateNotification(options.id, 'read')
          : route === 'notification-acknowledge' ? await synchronizer.updateNotification(options.id, 'acknowledged')
          : route === 'webhook-test' ? await synchronizer.testWebhook(options)
          : route === 'rollback' ? await synchronizer.rollbackHistory(options)
          : await synchronizer.run(options)
        return json(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        const code = error?.code === 'SETTINGS_CONFLICT' ? 409
          : error?.code === 'SETTINGS_UNAVAILABLE' || error?.code === 'CONFIG_UNAVAILABLE' ? 503
          : error?.code === 'PROVIDER_NOT_CONFIGURED' || error?.code === 'UNKNOWN_MODEL' || error?.code === 'INVALID_POLICY' || error?.code === 'INVALID_HISTORY' || error?.code === 'HISTORY_NOT_FOUND' || error?.code === 'INVALID_NOTIFICATION' || error?.code === 'NOTIFICATION_NOT_FOUND' || error?.code === 'INVALID_ALIAS' || error?.code === 'INVALID_CONFIG' ? 400 : 500
        return json(res, code, { error: { code: error?.code ?? 'run-failed', message: error instanceof Error ? error.message : String(error) } })
      }
    } catch (unhandledError) {
      if (typeof ctx?.logger?.error === 'function') {
        ctx.logger.error('[dsh-model-sync] unhandled HTTP error on route ' + route + ':', unhandledError)
      }
      return json(res, 500, { error: { code: 'internal_error', message: unhandledError instanceof Error ? unhandledError.message : String(unhandledError) } })
    }
  }

  return [
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/status`, handler: makeHandler('status') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/run`, handler: makeHandler('run') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/try`, handler: makeHandler('try') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/batch-try`, handler: makeHandler('batch-try') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/export`, handler: makeHandler('export') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/import`, handler: makeHandler('import') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/aliases`, handler: makeHandler('aliases') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/aliases/resolve`, handler: makeHandler('aliases-resolve') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/health`, handler: makeHandler('health') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/selection`, handler: makeHandler('selection') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/policy`, handler: makeHandler('policy') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/history`, handler: makeHandler('history') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/history/rollback`, handler: makeHandler('rollback') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/credentials`, handler: makeHandler('credentials') }),
    ctx.webServer.register({ kind: 'exact', path: `${BASE}/credentials/check`, handler: makeHandler('credentials-check') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/report', handler: makeHandler('report') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/notifications', handler: makeHandler('notifications') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/notifications/read', handler: makeHandler('notification-read') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/notifications/acknowledge', handler: makeHandler('notification-acknowledge') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/webhook/test', handler: makeHandler('webhook-test') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/health/latency', handler: makeHandler('health-latency') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/pricing', handler: makeHandler('pricing') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/probe/provider', handler: makeHandler('probe-provider') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/probe/all', handler: makeHandler('probe-all') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/probe/status', handler: makeHandler('probe-status') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/probe/verified', handler: makeHandler('probe-verified') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/ollama/ps', handler: makeHandler('ollama-ps') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/ollama/tags', handler: makeHandler('ollama-tags') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/ollama/info', handler: makeHandler('ollama-info') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/ollama/pull', handler: makeHandler('ollama-pull') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/ollama/pull/status', handler: makeHandler('ollama-pull-status') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/ollama/unload', handler: makeHandler('ollama-unload') }),
    ctx.webServer.register({ kind: 'exact', path: BASE + '/ollama/delete', handler: makeHandler('ollama-delete') }),
  ]
}
