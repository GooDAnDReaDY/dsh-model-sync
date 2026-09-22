import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isLoopback,
  isTrustedUpdateRequest,
  parseSemver,
  comparePrerelease,
  isNewerVersion,
  status,
  installExact,
  registerPluginUpdater,
  resetLatestCache,
  runtime,
} from '../lib/updater.js'

function makeMockRes() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(s, h) {
      this.status = s
      this.headers = h || {}
    },
    end(b) {
      this.body = b ?? ''
    },
  }
}

test('isLoopback identifies loopback IPs correctly', () => {
  assert.equal(isLoopback('127.0.0.1'), true)
  assert.equal(isLoopback('::1'), true)
  assert.equal(isLoopback('::ffff:127.0.0.1'), true)
  assert.equal(isLoopback('localhost'), true)
  assert.equal(isLoopback('192.168.1.1'), false)
  assert.equal(isLoopback(undefined), false)
})

test('parseSemver and comparePrerelease handle SemVer 2.0.0 and prereleases correctly', () => {
  assert.deepEqual(parseSemver('1.2.3'), { core: [1, 2, 3], prerelease: [] })
  assert.deepEqual(parseSemver('v0.4.0-beta.1'), { core: [0, 4, 0], prerelease: ['beta', '1'] })
  assert.equal(parseSemver('invalid'), undefined)

  // Prerelease comparisons
  assert.equal(comparePrerelease([], []), 0)
  assert.equal(comparePrerelease([], ['beta']), 1) // release > prerelease
  assert.equal(comparePrerelease(['beta'], []), -1) // prerelease < release
  assert.equal(comparePrerelease(['beta', '1'], ['beta', '2']), -1)
  assert.equal(comparePrerelease(['beta', '2'], ['beta', '1']), 1)
})

test('isNewerVersion recognizes core and prerelease upgrades', () => {
  // Minor / patch upgrades
  assert.equal(isNewerVersion('0.3.14', '0.4.0'), true)
  assert.equal(isNewerVersion('0.3.14', '0.3.14'), false)
  assert.equal(isNewerVersion('0.3.14', '0.3.13'), false)

  // Prerelease transitions
  assert.equal(isNewerVersion('0.3.14', '0.4.0-beta.1'), true)
  assert.equal(isNewerVersion('0.4.0-beta.1', '0.4.0-beta.2'), true)
  assert.equal(isNewerVersion('0.4.0-beta.1', '0.4.0'), true) // prerelease to release
  assert.equal(isNewerVersion('0.4.0', '0.4.0-beta.1'), false)
})

test('isTrustedUpdateRequest validates headers, loopback origin and remote socket', () => {
  // Missing update header
  assert.equal(isTrustedUpdateRequest({ headers: {} }), false)

  // Valid loopback request
  const validReq = {
    headers: {
      'x-dsh-plugin-update': '1',
      host: '127.0.0.1:3000',
      origin: 'http://127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(validReq), true)

  // Non-loopback remote socket rejected
  const externalRemote = {
    ...validReq,
    socket: { remoteAddress: '192.168.1.50' },
  }
  assert.equal(isTrustedUpdateRequest(externalRemote), false)

  // Cross-origin rejected
  const crossOrigin = {
    ...validReq,
    headers: {
      ...validReq.headers,
      origin: 'http://evil.com',
    },
  }
  assert.equal(isTrustedUpdateRequest(crossOrigin), false)

  // Mismatched host rejected
  const mismatchedHost = {
    ...validReq,
    headers: {
      ...validReq.headers,
      host: 'localhost:3001',
    },
  }
  assert.equal(isTrustedUpdateRequest(mismatchedHost), false)
})

test('status checks local package.json version and latest npm version', async () => {
  resetLatestCache()
  const manifestUrl = new URL('../package.json', import.meta.url)
  const target = { profileName: 'test-profile', profileDir: '/tmp', cliEntry: '/bin/dsh' }
  const res = await status({
    packageName: '@goodandready/dsh-model-sync',
    manifestUrl,
    registry: 'http://127.0.0.1:99999', // unreachable to trigger network fail
  }, target)

  assert.equal(res.packageName, '@goodandready/dsh-model-sync')
  assert.ok(typeof res.currentVersion === 'string')
  assert.equal(res.latestCheckFailed, true)
  assert.equal(res.updateAvailable, false)
  assert.equal(res.canAutoUpdate, true)
})

test('registerPluginUpdater registers GET, HEAD, POST routes and handles update flow', async () => {
  resetLatestCache()
  const routes = new Map()
  const ctx = {
    webServer: {
      register(opts) {
        routes.set(opts.path, opts.handler)
        return () => routes.delete(opts.path)
      },
    },
    logger: {
      warn() {},
    },
  }

  let installedSpec = null
  let installDelay = 0
  const mockInstallExact = async (target, spec) => {
    if (installDelay > 0) await new Promise((r) => setTimeout(r, installDelay))
    installedSpec = spec
  }

  const manifestUrl = new URL('../package.json', import.meta.url)
  let simulatedLatest = '9.9.9'
  const unregister = registerPluginUpdater(ctx, {
    packageName: '@goodandready/dsh-model-sync',
    manifestUrl,
    endpoint: '/api/dsh-model-sync/update',
    installExact: mockInstallExact,
    getLatestVersion: async () => simulatedLatest,
  })

  // Registered both endpoints
  assert.ok(routes.has('/api/dsh-model-sync/update'))
  assert.ok(routes.has('/dsh-model-sync/update'))

  const handler = routes.get('/api/dsh-model-sync/update')

  // 1. GET returns status
  const getRes = makeMockRes()
  await handler({ method: 'GET' }, getRes)
  assert.equal(getRes.status, 200)
  const getBody = JSON.parse(getRes.body)
  assert.equal(getBody.packageName, '@goodandready/dsh-model-sync')

  // 2. HEAD returns headers without body
  const headRes = makeMockRes()
  await handler({ method: 'HEAD' }, headRes)
  assert.equal(headRes.status, 200)
  assert.equal(headRes.body, '')

  // 3. Unsupported method 405
  const putRes = makeMockRes()
  await handler({ method: 'PUT' }, putRes)
  assert.equal(putRes.status, 405)

  // 4. Untrusted POST rejected with 403
  const untrustedRes = makeMockRes()
  await handler({
    method: 'POST',
    headers: {},
    socket: { remoteAddress: '10.0.0.1' },
  }, untrustedRes)
  assert.equal(untrustedRes.status, 403)

  // 5. Successful POST update
  const trustedPostReq = {
    method: 'POST',
    headers: {
      'x-dsh-plugin-update': '1',
      host: '127.0.0.1:3000',
      origin: 'http://127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  const postRes = makeMockRes()
  await handler(trustedPostReq, postRes)
  assert.equal(postRes.status, 200)
  const postBody = JSON.parse(postRes.body)
  assert.equal(postBody.restartRequired, true)
  assert.equal(postBody.updatedVersion, '9.9.9')
  assert.equal(installedSpec, '@goodandready/dsh-model-sync@9.9.9')

  // 6. Same version (no update available) returns 200 without installing
  simulatedLatest = getBody.currentVersion
  installedSpec = null
  const noUpRes = makeMockRes()
  await handler(trustedPostReq, noUpRes)
  assert.equal(noUpRes.status, 200)
  assert.equal(installedSpec, null)

  // 7. Network error (latestVersion undefined) returns 503
  simulatedLatest = undefined
  const netErrRes = makeMockRes()
  await handler(trustedPostReq, netErrRes)
  assert.equal(netErrRes.status, 503)

  // 8. Concurrent requests (double-click simulation) returns 409
  simulatedLatest = '0.4.0'
  installDelay = 50
  const req1Promise = handler(trustedPostReq, makeMockRes())
  const res2 = makeMockRes()
  await handler(trustedPostReq, res2)
  assert.equal(res2.status, 409)
  await req1Promise

  // Unregister cleans up
  unregister()
  assert.equal(routes.size, 0)
})

test('installExact checks cliEntry availability', async () => {
  await assert.rejects(
    async () => installExact({ cliEntry: undefined }, 'pkg@1.0.0'),
    /Automatic update is unavailable/
  )
})

test('runtime returns valid profile and directory', () => {
  const r = runtime()
  assert.ok(typeof r.profileName === 'string')
  assert.ok(typeof r.profileDir === 'string')
})
