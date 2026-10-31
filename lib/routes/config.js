/**
 * DeepSeek Harness Model Sync — Config Export/Import & Model Aliases Routes (#276, #281)
 */

import {
  readJson,
  normalizeAliasRequest,
} from '../http-normalizers.js'
import {
  sendJson,
  sendError,
  sendMethodNotAllowed,
  sendCaughtError,
} from './envelope.js'

export function createConfigRoutes(synchronizer) {
  return {
    async export(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      return sendJson(res, 200, synchronizer.exportConfig())
    },

    async import(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      try {
        const body = await readJson(req)
        const result = await synchronizer.importConfig(body)
        return sendJson(res, 200, result)
      } catch (error) {
        return sendCaughtError(res, error, 'import-failed', 500)
      }
    },

    async aliases(req, res) {
      if (req.method === 'GET') {
        return sendJson(res, 200, { aliases: synchronizer.getAliases() })
      }
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeAliasRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = options.action === 'delete'
          ? await synchronizer.deleteAlias(options)
          : await synchronizer.setAlias(options)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async 'aliases-resolve'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const urlObj = new URL(req.url, 'http://127.0.0.1')
        const alias = urlObj.searchParams.get('alias')
        if (!alias) return sendError(res, 400, 'bad-request', 'alias query parameter is required')
        return sendJson(res, 200, synchronizer.resolveAlias(alias))
      } catch (error) {
        return sendError(res, 400, error?.code ?? 'resolve-failed', error instanceof Error ? error.message : String(error))
      }
    },
  }
}
