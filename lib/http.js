/**
 * DeepSeek Harness Model Sync — HTTP API Dispatcher & Route Mounter (#218, #274, #276, #281)
 */

import {
  isLoopbackIp,
  assertAuthorizedRequest,
} from './access.js'
import { sendError } from './routes/envelope.js'
import { createCatalogRoutes } from './routes/catalog.js'
import { createProbingRoutes } from './routes/probing.js'
import { createConfigRoutes } from './routes/config.js'
import { createDiagnosticsRoutes } from './routes/diagnostics.js'
import { createOllamaRoutes } from './routes/ollama.js'

export * from './access.js'
export * from './http-normalizers.js'
export * from './routes/envelope.js'


const BASE = '/dsh-model-sync'

const ROUTE_TABLE = [
  ['/status', 'status'],
  ['/run', 'run'],
  ['/try', 'try'],
  ['/batch-try', 'batch-try'],
  ['/export', 'export'],
  ['/import', 'import'],
  ['/aliases', 'aliases'],
  ['/aliases/resolve', 'aliases-resolve'],
  ['/health', 'health'],
  ['/selection', 'selection'],
  ['/policy', 'policy'],
  ['/history', 'history'],
  ['/history/rollback', 'rollback'],
  ['/credentials', 'credentials'],
  ['/credentials/check', 'credentials-check'],
  ['/report', 'report'],
  ['/notifications', 'notifications'],
  ['/notifications/read', 'notification-read'],
  ['/notifications/acknowledge', 'notification-acknowledge'],
  ['/webhook/test', 'webhook-test'],
  ['/health/latency', 'health-latency'],
  ['/pricing', 'pricing'],
  ['/probe/provider', 'probe-provider'],
  ['/probe/all', 'probe-all'],
  ['/probe/status', 'probe-status'],
  ['/probe/verified', 'probe-verified'],
  ['/ollama/ps', 'ollama-ps'],
  ['/ollama/tags', 'ollama-tags'],
  ['/ollama/info', 'ollama-info'],
  ['/ollama/pull', 'ollama-pull'],
  ['/ollama/pull/status', 'ollama-pull-status'],
  ['/ollama/unload', 'ollama-unload'],
  ['/ollama/delete', 'ollama-delete'],
]

export function registerHttpApi(ctx, synchronizer, { getSchedulerStatus = () => null } = {}) {
  if (typeof ctx?.webServer?.register !== 'function') {
    if (typeof ctx?.logger?.warn === 'function') {
      ctx.logger.warn('[dsh-model-sync] webServer service unavailable, HTTP API skipped')
    }
    return []
  }

  const handlers = {
    ...createCatalogRoutes(synchronizer, { getSchedulerStatus }),
    ...createProbingRoutes(synchronizer),
    ...createConfigRoutes(synchronizer),
    ...createDiagnosticsRoutes(synchronizer),
    ...createOllamaRoutes(synchronizer),
  }

  const makeHandler = (route) => async (req, res) => {
    try {
      const isPublicStatus = route === 'status' && req.method === 'GET'
      if (!assertAuthorizedRequest(req, res, ctx, { isPublic: isPublicStatus })) {
        return
      }
      const routeHandler = handlers[route]
      if (typeof routeHandler !== 'function') {
        return sendError(res, 404, 'not_found', `Unknown route: ${route}`)
      }
      return await routeHandler(req, res)
    } catch (unhandledError) {
      if (typeof ctx?.logger?.error === 'function') {
        ctx.logger.error('[dsh-model-sync] unhandled HTTP error on route ' + route + ':', unhandledError)
      }
      return sendError(
        res,
        500,
        'internal_error',
        unhandledError instanceof Error ? unhandledError.message : String(unhandledError),
      )
    }
  }

  return ROUTE_TABLE.map(([suffix, routeKey]) =>
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}${suffix}`,
      handler: makeHandler(routeKey),
    }),
  )
}
