/**
 * DeepSeek Harness Model Sync — Ollama Hub Routes (#268, #276, #281)
 */

import { readJson } from '../http-normalizers.js'
import {
  sendJson,
  sendError,
  sendMethodNotAllowed,
  sendCaughtError,
} from './envelope.js'

export function createOllamaRoutes(synchronizer) {
  return {
    async 'ollama-ps'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const data = typeof synchronizer.ollamaPs === 'function'
          ? await synchronizer.ollamaPs()
          : { ok: false, error: 'ollama unavailable' }
        return sendJson(res, 200, data)
      } catch (error) {
        return sendCaughtError(res, error, 'ollama-failed', 500)
      }
    },

    async 'ollama-tags'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const data = typeof synchronizer.ollamaTags === 'function'
          ? await synchronizer.ollamaTags()
          : { ok: false, models: [] }
        return sendJson(res, 200, data)
      } catch (error) {
        return sendCaughtError(res, error, 'ollama-failed', 500)
      }
    },

    async 'ollama-info'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const urlObj = new URL(req.url, 'http://127.0.0.1')
        const model = urlObj.searchParams.get('model') || ''
        const data = typeof synchronizer.ollamaShow === 'function'
          ? await synchronizer.ollamaShow(model)
          : { ok: false, error: 'ollama unavailable' }
        return sendJson(res, 200, data)
      } catch (error) {
        return sendCaughtError(res, error, 'ollama-failed', 500)
      }
    },

    async 'ollama-pull'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      try {
        const body = await readJson(req)
        if (!body || typeof body.model !== 'string' || !body.model.trim()) {
          return sendError(res, 400, 'bad-request', 'model name is required')
        }
        const data = typeof synchronizer.ollamaPull === 'function'
          ? await synchronizer.ollamaPull(body.model.trim())
          : { ok: false, error: 'ollama unavailable' }
        return sendJson(res, 200, data)
      } catch (error) {
        return sendCaughtError(res, error, 'ollama-failed', 500)
      }
    },

    async 'ollama-pull-status'(req, res) {
      if (req.method !== 'GET') return sendMethodNotAllowed(res, 'GET')
      try {
        const urlObj = new URL(req.url, 'http://127.0.0.1')
        const model = urlObj.searchParams.get('model') || ''
        const data = typeof synchronizer.ollamaPullStatus === 'function'
          ? synchronizer.ollamaPullStatus(model)
          : { active: false }
        return sendJson(res, 200, data)
      } catch (error) {
        return sendCaughtError(res, error, 'ollama-failed', 500)
      }
    },

    async 'ollama-unload'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      try {
        const body = await readJson(req)
        if (!body || typeof body.model !== 'string' || !body.model.trim()) {
          return sendError(res, 400, 'bad-request', 'model name is required')
        }
        const data = typeof synchronizer.ollamaUnload === 'function'
          ? await synchronizer.ollamaUnload(body.model.trim())
          : { ok: false, error: 'ollama unavailable' }
        return sendJson(res, 200, data)
      } catch (error) {
        return sendCaughtError(res, error, 'ollama-failed', 500)
      }
    },

    async 'ollama-delete'(req, res) {
      if (req.method !== 'POST') return sendMethodNotAllowed(res, 'POST')
      try {
        const body = await readJson(req)
        if (!body || typeof body.model !== 'string' || !body.model.trim()) {
          return sendError(res, 400, 'bad-request', 'model name is required')
        }
        const data = typeof synchronizer.ollamaDelete === 'function'
          ? await synchronizer.ollamaDelete(body.model.trim())
          : { ok: false, error: 'ollama unavailable' }
        return sendJson(res, 200, data)
      } catch (error) {
        return sendCaughtError(res, error, 'ollama-failed', 500)
      }
    },
  }
}
