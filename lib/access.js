/**
 * DeepSeek Harness Model Sync — Access Control & Route Guard (#218, #257, #259)
 * Implements strict network boundary validation, reverse proxy (dsh-lanmode)
 * client credential checks, loopback admission, and CSRF protection.
 */

import crypto from 'node:crypto'

export function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

export function getConnection(ctx) {
  try {
    const fromReflect = ctx?.reflect?.get ? ctx.reflect.get('connection') : undefined
    if (fromReflect) return fromReflect
    const fromGet = typeof ctx?.get === 'function' ? ctx.get('connection') : undefined
    if (fromGet) return fromGet
    const direct = ctx?.connection
    if (direct) return direct
    if (ctx?.root) return getConnection(ctx.root)
    return undefined
  } catch {
    return undefined
  }
}

export function isLoopbackIp(ip) {
  if (!ip || typeof ip !== 'string') return false
  const clean = ip.trim().toLowerCase().replace(/^::ffff:/, '').replace(/^\[|\]$/g, '')
  // Exact match for known loopback addresses; rejects 127.attacker.example DNS names
  return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost'
}

export function cookieNameForAuthority(authority) {
  if (!authority || typeof authority !== 'string') return ''
  const hash = crypto.createHash('sha256').update(authority.trim()).digest('base64url')
  return 'dsh-auth-' + hash
}

export function isLoopbackCookieName(name, host = '') {
  if (!name || typeof name !== 'string' || !name.startsWith('dsh-auth-')) return false
  const authorities = [
    host,
    '127.0.0.1:3000',
    '127.0.0.1:3080',
    '127.0.0.1:3082',
    '127.0.0.1',
    'localhost:3000',
    'localhost:3080',
    'localhost:3082',
    'localhost',
    '[::1]:3000',
    '[::1]',
  ]
  for (const auth of authorities) {
    if (auth && isLoopbackIp(auth.split(':')[0])) {
      if (cookieNameForAuthority(auth) === name) return true
    }
  }
  return false
}

export function hasClientCredentials(req) {
  if (!req || !req.headers) return false
  const cookie = req.headers.cookie
  if (!cookie || typeof cookie !== 'string') return false
  if (
    cookie.includes('dsh_token=') ||
    cookie.includes('dsh_lan_pin=') ||
    cookie.includes('dsh_auth_session=')
  ) {
    return true
  }

  const parts = cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const name = trimmed.slice(0, eqIdx).trim()
    if (name.startsWith('dsh-auth-')) {
      if (!isLoopbackCookieName(name, req.headers.host)) {
        return true
      }
    }
  }
  return false
}

/**
 * Validates whether an incoming HTTP request is authenticated and admitted (#218, #257).
 *
 * Requirements:
 * 1. Authoritative DSH connection gate: if connection.requestRejection is present,
 *    its verdict (401, 403, or undefined) is authoritative for all routes.
 * 2. CSRF protection: rejects sec-fetch-site: cross-site with 403, validates Origin & Referer against Host.
 * 3. Public routes (e.g. GET /status) only require connection approval and anti-CSRF.
 * 4. Sensitive routes (POST routes, /history, /export, /credentials, etc.):
 *    - Genuine loopback traffic (127.0.0.1 / ::1 / localhost) not forwarded from a remote proxy is admitted.
 *    - Reverse-proxy (dsh-lanmode) forwarded remote requests require client credentials (401 if missing).
 *    - Direct non-loopback calls fail closed with 403.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {any} [ctx]
 * @param {{ isPublic?: boolean }} [options]
 * @returns {number|undefined} Rejection status (401, 403) or undefined if admitted.
 */
export function getReadRejectionStatus(req, ctx = null, { isPublic = false } = {}) {
  if (!req || !req.headers) return 403

  // 1. Authoritative DSH connection service check (#237, #257, #259)
  const conn = getConnection(ctx) || req?.connectionService
  if (conn && typeof conn.requestRejection === 'function') {
    let rejection
    try {
      rejection = conn.requestRejection(req)
    } catch {
      rejection = 403
    }
    if (rejection !== undefined) {
      if (typeof rejection === 'number' && Number.isInteger(rejection) && rejection >= 400 && rejection < 600) {
        return rejection
      }
      return rejection === 401 ? 401 : 403
    }
  }

  // 2. Strict CSRF protection: reject cross-site requests
  const site = req.headers['sec-fetch-site']
  if (site === 'cross-site') {
    return 403
  }

  const host = String(req.headers.host || '').trim().toLowerCase()
  const origin = req.headers.origin
  if (origin && origin !== 'null') {
    try {
      const u = new URL(origin)
      if (host && u.host.toLowerCase() !== host) {
        return 403
      }
    } catch {
      return 403
    }
  }

  const referer = req.headers.referer
  if (referer) {
    try {
      const u = new URL(referer)
      if (host && u.host.toLowerCase() !== host) {
        return 403
      }
    } catch {
      return 403
    }
  }

  // 3. Public endpoints (e.g. GET /status) are admitted after CSRF and connection checks
  if (isPublic) {
    return undefined
  }

  // 4. Reverse-proxy / forwarded client verification (#218, #257)
  const xff = req.headers['x-forwarded-for']
  let isForwardedRemote = false
  if (xff && typeof xff === 'string') {
    const firstIp = xff.split(',')[0].trim()
    if (firstIp && !isLoopbackIp(firstIp)) {
      isForwardedRemote = true
      if (!hasClientCredentials(req)) {
        return 401
      }
    }
  }

  // 5. Direct socket remote address verification
  const rawRemote = req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''
  const cleanRemote = String(rawRemote).trim().toLowerCase().replace(/^::ffff:/, '')

  // Genuine loopback / in-process callers are admitted (#218, #271)
  if (cleanRemote && isLoopbackIp(cleanRemote) && !isForwardedRemote) {
    return undefined
  }

  // Forwarded remote requests with valid client credentials are admitted
  if (isForwardedRemote && hasClientCredentials(req)) {
    return undefined
  }

  // Direct socket non-loopback calls fail closed
  if (cleanRemote && !isLoopbackIp(cleanRemote)) {
    return 403
  }

  if (isForwardedRemote) {
    return 401
  }

  // Non-loopback Host header when remote socket address is absent
  if (!cleanRemote && host) {
    const hostName = host.split(':')[0]
    if (!isLoopbackIp(hostName)) {
      return 403
    }
  }

  if (req?.socket && !cleanRemote) {
    return 403
  }

  return undefined
}

/**
 * Backwards-compatible trusted check used by existing tests and updater (#218).
 */
export function trusted(req, { requireLoopback = false, ctx = null } = {}) {
  const status = getReadRejectionStatus(req, ctx, { isPublic: !requireLoopback && req?.method !== 'POST' })
  return status === undefined
}

export function assertAuthorizedRequest(req, res, ctx = null, { isPublic = false } = {}) {
  const status = getReadRejectionStatus(req, ctx, { isPublic })
  if (status !== undefined) {
    writeJson(res, status, {
      error: {
        code: status === 401 ? 'unauthorized' : 'forbidden',
        message: status === 401 ? 'Authentication required' : 'dsh-model-sync: cross-origin or non-loopback request rejected',
      },
    })
    return false
  }
  return true
}