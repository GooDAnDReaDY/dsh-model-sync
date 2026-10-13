import test from 'node:test'
import assert from 'node:assert/strict'
import { inject } from '../lib/index.js'
import { settingsOf, llmOf } from '../lib/synchronizer-helpers.js'
import { createProviderService } from '../lib/provider-service.js'
import { registerHttpApi } from '../lib/http.js'

test('issue #259: inject declaration includes settings service', () => {
  assert.ok(Array.isArray(inject), 'inject must be an array')
  assert.ok(inject.includes('settings'), 'inject must declare settings service')
  assert.ok(inject.includes('llm'), 'inject must declare llm service')
  assert.ok(inject.includes('webServer'), 'inject must declare webServer service')
  assert.ok(inject.includes('credentials'), 'inject must declare credentials service')
})

test('issue #259: settingsOf and llmOf safely handle throwing context getters without escaping', () => {
  // Simulate Cordis v4 throwing on un-injected property access
  const mockCordisCtx = {
    get settings() {
      throw new Error('cannot get property "settings" without inject')
    },
    get llm() {
      throw new Error('cannot get property "llm" without inject')
    },
    reflect: {
      get(name) {
        return undefined
      }
    }
  }

  assert.doesNotThrow(() => {
    const s = settingsOf(mockCordisCtx)
    assert.equal(s, undefined)
  }, 'settingsOf must not throw when getter throws')

  assert.doesNotThrow(() => {
    const l = llmOf(mockCordisCtx)
    assert.equal(l, undefined)
  }, 'llmOf must not throw when getter throws')

  // provider-service must also not throw
  const providerService = createProviderService(mockCordisCtx)
  assert.doesNotThrow(() => {
    const list = providerService.listProviders()
    assert.deepEqual(list, [])
  }, 'providerService.listProviders must return empty array when services are not available')

  // null and undefined ctx
  assert.equal(settingsOf(null), undefined)
  assert.equal(settingsOf(undefined), undefined)
  assert.equal(llmOf(null), undefined)
  assert.equal(llmOf(undefined), undefined)
})

test('issue #259: makeHandler catches unexpected synchronizer exceptions and returns JSON 500', async () => {
  const brokenSynchronizer = {
    status() {
      throw new Error('unexpected database or internal crash')
    },
    listProviders() {
      return []
    }
  }

  let loggedError = null
  const mockCtx = {
    webServer: { register: (r) => r },
    logger: {
      error: (msg, err) => { loggedError = { msg, err } },
      warn: () => {}
    }
  }

  const routes = registerHttpApi(mockCtx, brokenSynchronizer, { getSchedulerStatus: () => null })
  const statusRoute = routes.find((r) => r.path === '/dsh-model-sync/status')
  assert.ok(statusRoute, 'status route must be registered')

  const req = {
    method: 'GET',
    url: '/dsh-model-sync/status',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' }
  }

  let statusCode = null
  let headers = null
  let responseBody = ''
  const res = {
    writeHead(status, hdrs) {
      statusCode = status
      headers = hdrs
    },
    end(body) {
      responseBody = body
    }
  }

  await assert.doesNotReject(async () => {
    await statusRoute.handler(req, res)
  }, 'handler must never throw uncaught rejection')

  assert.equal(statusCode, 500)
  assert.match(headers['content-type'], /application\/json/)
  const parsed = JSON.parse(responseBody)
  assert.equal(parsed.error.code, 'internal_error')
  assert.match(parsed.error.message, /unexpected database or internal crash/)
  assert.ok(loggedError, 'error must be logged to ctx.logger.error')
})
