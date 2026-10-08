import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePolicy } from '../lib/policy.js'
import { dispatchDiffNotifications, sendWebhookNotification, isForbiddenWebhookHost, isLoopbackHost } from '../lib/diff-notifier.js'
import { isLoopbackAddress, trusted, registerHttpApi } from '../lib/http.js'
import { isLoopback, isTrustedUpdateRequest, registerPluginUpdater } from '../lib/updater.js'
import { sanitizeSecretString, createCredentialResolver } from '../lib/credentials.js'

test('#202: ReDoS guard blocks overlapping alternations and catastrophic patterns', () => {
  // Overlapping alternations
  assert.throws(
    () => validatePolicy({ include: ['^(a|aa)+$'] }),
    (err) => err.code === 'INVALID_POLICY' && /catastrophic backtracking risk/.test(err.message),
    '^(a|aa)+$ must be rejected'
  )
  assert.throws(
    () => validatePolicy({ include: ['(a|b)+'] }),
    (err) => err.code === 'INVALID_POLICY' && /catastrophic backtracking risk/.test(err.message)
  )
  assert.throws(
    () => validatePolicy({ include: ['((a|aa))+'] }),
    (err) => err.code === 'INVALID_POLICY' && /catastrophic backtracking risk/.test(err.message)
  )
  assert.throws(
    () => validatePolicy({ include: ['(a|aa){2,}'] }),
    (err) => err.code === 'INVALID_POLICY' && /catastrophic backtracking risk/.test(err.message)
  )
  // Nested quantifiers
  assert.throws(
    () => validatePolicy({ include: ['(a+)+$'] }),
    (err) => err.code === 'INVALID_POLICY'
  )

  // Normal model patterns must succeed
  const valid = validatePolicy({
    include: ['^gpt-4o', '(claude-3|gemini-1.5)', 'deepseek-.*', 'model-[0-9]+'],
    exclude: ['legacy'],
  })
  assert.equal(valid.include.length, 4)
})

test('#204: webhook notification fails closed when secretRef cannot be resolved', async () => {
  let fetchCalled = false
  const ctx = {
    logger: { warn: () => {}, debug: () => {} },
    credentials: {
      resolve: async (ref) => {
        // simulate unconfigured or failed credential
        return null
      },
    },
  }

  const config = {
    diffWebhookUrl: 'https://webhook.example/events',
    diffWebhookSecretRef: 'UNCONFIGURED_WEBHOOK_SECRET',
    notifyOnModelAdded: true,
  }

  const results = [
    {
      provider: 'deepseek',
      diff: { added: [{ id: 'deepseek-v4', name: 'DeepSeek V4' }] },
    },
  ]

  const res = await dispatchDiffNotifications(ctx, config, results, {
    fetchImpl: async () => {
      fetchCalled = true
      return new Response('OK', { status: 200 })
    },
  })

  // Must fail closed: do not send unsigned webhook!
  assert.equal(res.ok, false)
  assert.equal(res.error, 'credential_resolution_failed')
  assert.equal(fetchCalled, false, 'fetchImpl must NOT be called when secret resolution fails')
})

test('#205: webhook URL guard blocks IPv4-mapped metadata, cloud DNS names and link-local', async () => {
  // IPv4-mapped metadata: [::ffff:169.254.169.254] (or hex [::ffff:a9fe:a9fe])
  assert.equal(isForbiddenWebhookHost('::ffff:169.254.169.254'), true)
  assert.equal(isForbiddenWebhookHost('::ffff:a9fe:a9fe'), true)
  assert.equal(isForbiddenWebhookHost('169.254.169.254'), true)

  // Cloud metadata hostnames
  assert.equal(isForbiddenWebhookHost('instance-data'), true)
  assert.equal(isForbiddenWebhookHost('metadata.google.internal'), true)
  assert.equal(isForbiddenWebhookHost('metadata'), true)
  assert.equal(isForbiddenWebhookHost('100.100.100.200'), true)
  assert.equal(isForbiddenWebhookHost('fe80::1'), true)

  // sendWebhookNotification tests
  const metaRes = await sendWebhookNotification('http://[::ffff:169.254.169.254]/latest/meta-data/', '', {})
  assert.equal(metaRes.ok, false)
  assert.match(metaRes.error, /forbidden metadata or link-local/)

  const awsRes = await sendWebhookNotification('http://instance-data/latest/meta-data/', '', {})
  assert.equal(awsRes.ok, false)
  assert.match(awsRes.error, /forbidden metadata or link-local/)

  const alibabaRes = await sendWebhookNotification('http://100.100.100.200/latest/meta-data/', '', {})
  assert.equal(alibabaRes.ok, false)
  assert.match(alibabaRes.error, /forbidden metadata or link-local/)

  // 127.* hostname guard: 127.attacker.example is NOT loopback
  assert.equal(isLoopbackHost('127.attacker.example'), false)
  assert.equal(isLoopbackAddress('127.attacker.example'), false)

  const extInsecure = await sendWebhookNotification('http://127.attacker.example/webhook', '', {})
  assert.equal(extInsecure.ok, false)
  assert.match(extInsecure.error, /insecure http webhook url is only permitted on loopback/)
})

test('#237: core auth requestRejection rejects API and updater routes, loopback guard rejects 127.* DNS hostnames', async () => {
  // 1. isLoopback rejects DNS hostnames
  assert.equal(isLoopback('127.attacker.example'), false)
  assert.equal(isLoopback('127.0.0.1'), true)
  assert.equal(isLoopback('localhost'), true)
  assert.equal(isLoopback('::1'), true)

  // 2. Updater: rejected when connection.requestRejection returns 401
  let installCalled = false
  const mockCtx = {
    webServer: { register: () => () => {} },
    connection: { requestRejection: (req) => 401 },
  }

  const updaterReq = {
    method: 'POST',
    url: '/dsh-model-sync/update',
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3080',
      host: '127.0.0.1:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }

  assert.equal(isTrustedUpdateRequest(updaterReq, mockCtx), false, 'isTrustedUpdateRequest must reject when requestRejection returns 401')

  // 3. Updater route handler rejects 401 before any install
  let updaterHandler = null
  const regCtx = {
    webServer: {
      register: ({ handler }) => {
        updaterHandler = handler
        return () => {}
      },
    },
    connection: { requestRejection: () => 401 },
  }

  registerPluginUpdater(regCtx, {
    installExact: async () => { installCalled = true },
  })

  const mockRes = {
    status: 0,
    headers: {},
    body: '',
    writeHead(s, h) { this.status = s; this.headers = h },
    end(b) { this.body = b ?? '' },
  }

  await updaterHandler(updaterReq, mockRes)
  assert.equal(mockRes.status, 401)
  assert.equal(installCalled, false, 'install must not be called when requestRejection returns 401')

  // 4. Also rejects 127.attacker.example even without connection service
  const attackerReq = {
    method: 'POST',
    url: '/dsh-model-sync/update',
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.attacker.example:3080',
      host: '127.attacker.example:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(attackerReq, {}), false)

  // 5. HTTP API routes reject when core connection rejects
  const apiRoutes = new Map()
  const apiCtx = {
    webServer: {
      register: (r) => { apiRoutes.set(r.path, r.handler); return () => {} },
    },
    connection: { requestRejection: () => 403 },
  }
  registerHttpApi(apiCtx, { status: () => ({ running: false }), listProviders: () => [] })
  const apiRes = {
    status: 0,
    headers: {},
    body: '',
    writeHead(s, h) { this.status = s; this.headers = h },
    end(b) { this.body = b ?? '' },
  }
  await apiRoutes.get('/dsh-model-sync/status')({ method: 'GET', socket: { remoteAddress: '127.0.0.1' } }, apiRes)
  assert.equal(apiRes.status, 403)
})

test('#238: sanitizeSecretString masks Authorization: Bearer, Basic, token and query secrets', async () => {
  assert.equal(
    sanitizeSecretString('Authorization: Bearer AUDIT_DUMMY_SECRET'),
    'Authorization=[redacted]'
  )
  assert.equal(
    sanitizeSecretString('Authorization: Basic dXNlcjpwYXNz'),
    'Authorization=[redacted]'
  )
  assert.equal(
    sanitizeSecretString('Authorization=Bearer MY_SECRET_TOKEN'),
    'Authorization=[redacted]'
  )
  assert.equal(
    sanitizeSecretString('Error: failed with Bearer sk-live-secret-token-12345'),
    'Error: failed with Bearer [redacted]'
  )
  assert.equal(
    sanitizeSecretString('Request URL: https://api.example.com/v1?token=SECRET_12345&foo=bar'),
    'Request URL: https://api.example.com/v1?token=[redacted]&foo=bar'
  )
  assert.equal(
    sanitizeSecretString('api_key: sk-secret-abc'),
    'api_key=[redacted]'
  )

  // Test createCredentialResolver does not leak secret in message
  const ctx = {
    credentials: {
      resolve: async () => {
        throw new Error('Authorization: Bearer AUDIT_DUMMY_SECRET failed')
      },
    },
  }
  const resolver = createCredentialResolver(ctx)
  await assert.rejects(
    async () => resolver('TEST_KEY'),
    (err) => {
      assert.ok(!err.message.includes('AUDIT_DUMMY_SECRET'), 'Error message must NOT contain AUDIT_DUMMY_SECRET')
      assert.ok(err.message.includes('[redacted]'))
      return true
    }
  )
})
