/**
 * DeepSeek Harness Model Sync — Probing, Health & Latency Radar Routes (#276, #281)
 */

import {
  readJson,
  normalizeTryRequest,
  normalizeBatchTryRequest,
  normalizeHealthRequest,
} from '../http-normalizers.js'
import {
  sendJson,
  sendError,
  sendMethodNotAllowed,
  sendCaughtError,
} from './envelope.js'

export function createProbingRoutes(synchronizer) {
  return {
    async try(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeTryRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.tryModel(options)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async 'batch-try'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeBatchTryRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.batchTryModels(options)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async health(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeHealthRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.health(options)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async 'health-latency'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const urlObj = new URL(req.url, 'http://127.0.0.1')
        const provider = urlObj.searchParams.get('provider') || undefined
        const report = typeof synchronizer.getLatencyRadar === 'function'
          ? synchronizer.getLatencyRadar({ provider })
          : { updatedAt: Date.now(), radar: [] }
        return sendJson(res, 200, report)
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
    },

    async 'probe-provider'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      try {
        const body = await readJson(req)
        if (!body || typeof body.provider !== 'string' || !body.provider.trim()) {
          return sendError(res, 400, 'bad-request', 'provider is required')
        }
        const provider = body.provider.trim()
        const concurrency = Number.isInteger(body.concurrency) ? body.concurrency : 3
        const onlyNew = Boolean(body.onlyNew)
        const result = typeof synchronizer.probeCapabilitiesForProvider === 'function'
          ? await synchronizer.probeCapabilitiesForProvider(provider, { concurrency, onlyNew })
          : { ok: false, error: 'prober unavailable' }
        return sendJson(res, 200, result)
      } catch (error) {
        return sendCaughtError(res, error, 'probe-failed', 500)
      }
    },

    async 'probe-all'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      try {
        const body = await readJson(req)
        const concurrency = Number.isInteger(body?.concurrency) ? body.concurrency : 3
        const onlyNew = Boolean(body?.onlyNew)
        const result = typeof synchronizer.probeAllCapabilities === 'function'
          ? await synchronizer.probeAllCapabilities({ concurrency, onlyNew })
          : { ok: false, error: 'prober unavailable' }
        return sendJson(res, 200, result)
      } catch (error) {
        return sendCaughtError(res, error, 'probe-failed', 500)
      }
    },

    async 'probe-status'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const status = typeof synchronizer.getProbingStatus === 'function'
          ? synchronizer.getProbingStatus()
          : { isProbing: false, progress: { total: 0, completed: 0 } }
        return sendJson(res, 200, status)
      } catch (error) {
        return sendCaughtError(res, error, 'probe-status-failed', 500)
      }
    },

    async 'probe-verified'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const verified = typeof synchronizer.getVerifiedCapabilities === 'function'
          ? synchronizer.getVerifiedCapabilities()
          : {}
        return sendJson(res, 200, verified)
      } catch (error) {
        return sendCaughtError(res, error, 'probe-verified-failed', 500)
      }
    },
  }
}
