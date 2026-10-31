/**
 * DeepSeek Harness Model Sync — Catalog, Sync, Policy & Pricing Routes (#276, #281)
 */

import crypto from 'node:crypto'
import {
  readJson,
  normalizeRunRequest,
  normalizeSelectionRequest,
  normalizePolicyRequest,
} from '../http-normalizers.js'
import {
  sendJson,
  sendError,
  sendMethodNotAllowed,
  sendCaughtError,
} from './envelope.js'

export function createCatalogRoutes(synchronizer, { getSchedulerStatus = () => null } = {}) {
  return {
    async status(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      const payload = {
        ...synchronizer.status(),
        scheduler: getSchedulerStatus(),
        providers: synchronizer.listProviders(),
      }
      const bodyStr = JSON.stringify(payload)
      const etag = 'W/"' + crypto.createHash('sha1').update(bodyStr).digest('hex').slice(0, 16) + '"'
      const clientEtag = req.headers?.['if-none-match']
      if (clientEtag && clientEtag.trim() === etag) {
        res.writeHead(304, { etag })
        return res.end()
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', etag })
      return res.end(bodyStr)
    },

    async run(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeRunRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.run(options)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async selection(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeSelectionRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.setModelSelection(options.provider, options.models)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async policy(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizePolicyRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.setModelPolicy(options.provider, options.policy)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async pricing(req, res) {
      if (req.method === 'GET') {
        try {
          const urlObj = new URL(req.url, 'http://127.0.0.1')
          const provider = urlObj.searchParams.get('provider') || undefined
          const model = urlObj.searchParams.get('model') || undefined
          const report = typeof synchronizer.getPricingInfo === 'function'
            ? synchronizer.getPricingInfo({ provider, model })
            : { dynamicCount: 0, sample: {} }
          return sendJson(res, 200, report)
        } catch (error) {
          return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
        }
      }
      if (req.method === 'POST') {
        try {
          const result = typeof synchronizer.syncPricing === 'function'
            ? await synchronizer.syncPricing()
            : { updated: 0, source: 'none' }
          return sendJson(res, 200, result)
        } catch (error) {
          return sendCaughtError(res, error, 'pricing-sync-failed', 500)
        }
      }
      return sendMethodNotAllowed(res, 'GET or POST')
    },
  }
}
