/**
 * DeepSeek Harness Model Sync — Unified API Response & Error Envelope (#281)
 */

import { writeJson } from '../access.js'

const CLIENT_ERROR_CODES = new Set([
  'BAD_REQUEST',
  'bad-request',
  'PROVIDER_NOT_CONFIGURED',
  'UNKNOWN_MODEL',
  'INVALID_POLICY',
  'INVALID_HISTORY',
  'HISTORY_NOT_FOUND',
  'INVALID_NOTIFICATION',
  'NOTIFICATION_NOT_FOUND',
  'INVALID_ALIAS',
  'INVALID_CONFIG',
  'INVALID_STRATEGY',
])

export function statusForErrorCode(code, fallback = 500) {
  if (!code) return fallback
  if (code === 'SETTINGS_CONFLICT') return 409
  if (code === 'SETTINGS_UNAVAILABLE' || code === 'CONFIG_UNAVAILABLE') return 503
  if (CLIENT_ERROR_CODES.has(code)) return 400
  return fallback
}

export function sendJson(res, status, body) {
  writeJson(res, status, body)
}

export function sendEnvelope(res, data, meta = undefined, status = 200) {
  const isObj = data !== null && typeof data === 'object' && !Array.isArray(data)
  const payload = {
    ok: true,
    ...(isObj ? data : { data }),
    ...(meta !== undefined ? { meta } : {}),
  }
  writeJson(res, status, payload)
}

export function sendError(res, status, code, message, details = undefined) {
  const errObj = {
    code: String(code || 'internal_error'),
    message: String(message || 'Unknown error'),
  }
  if (details !== undefined) {
    errObj.details = details
  }
  writeJson(res, status, {
    ok: false,
    error: errObj,
  })
}

export function sendMethodNotAllowed(res, allowed = 'GET') {
  sendError(res, 405, 'method', `${allowed} only`)
}

export function sendCaughtError(res, error, defaultCode = 'internal_error', fallbackStatus = 500) {
  const code = error?.code ?? defaultCode
  const status = statusForErrorCode(error?.code, fallbackStatus)
  const message = error instanceof Error ? error.message : String(error)
  sendError(res, status, code, message, error?.details)
}
