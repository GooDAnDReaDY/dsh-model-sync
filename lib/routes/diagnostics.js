/**
 * DeepSeek Harness Model Sync — History, Credentials, Notifications & Webhook Routes (#276, #281)
 */

import {
  readJson,
  normalizeHistoryRequest,
  normalizeHistoryRollbackRequest,
  normalizeCredentialRequest,
  normalizeCredentialCheckRequest,
  normalizeNotificationRequest,
  normalizeNotificationAction,
  normalizeWebhookTestRequest,
} from '../http-normalizers.js'
import {
  sendJson,
  sendError,
  sendMethodNotAllowed,
  sendCaughtError,
} from './envelope.js'

export function createDiagnosticsRoutes(synchronizer) {
  return {
    async history(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        return sendJson(res, 200, { history: synchronizer.history(normalizeHistoryRequest(req.url)) })
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
    },

    async rollback(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeHistoryRollbackRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.rollbackHistory(options)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async credentials(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        return sendJson(res, 200, await synchronizer.credentialDiagnostics(normalizeCredentialRequest(req.url)))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
    },

    async 'credentials-check'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeCredentialCheckRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = {
          health: await synchronizer.health(options),
          credentials: await synchronizer.credentialDiagnostics(options),
        }
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async report(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      return sendJson(res, 200, { report: synchronizer.report() })
    },

    async notifications(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      return sendJson(res, 200, { notifications: synchronizer.notifications(normalizeNotificationRequest(req.url)) })
    },

    async 'notification-read'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeNotificationAction(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.updateNotification(options.id, 'read')
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async 'notification-acknowledge'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeNotificationAction(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.updateNotification(options.id, 'acknowledge')
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },

    async 'webhook-test'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      let options
      try {
        options = normalizeWebhookTestRequest(await readJson(req))
      } catch (error) {
        return sendError(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      }
      try {
        const result = await synchronizer.testWebhook(options)
        return sendJson(res, 200, { ...result, providers: synchronizer.listProviders() })
      } catch (error) {
        return sendCaughtError(res, error, 'run-failed', 500)
      }
    },
  }
}
