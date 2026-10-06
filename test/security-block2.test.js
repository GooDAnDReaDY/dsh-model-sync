import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdapterConfig, createProviderAdapterRegistry } from '../lib/adapter-registry.js'
import { registerHttpApi, isLoopbackAddress, trusted } from '../lib/http.js'
import { sendWebhookNotification, dispatchDiffNotifications } from '../lib/diff-notifier.js'
import { installExact } from '../lib/updater.js'
import { Config } from '../lib/index.js'

test('issue #194: prevents API key exfiltration via custom adapter endpoint host mismatch', () => {
  // Built-in deepseek adapter targeted to attacker host must be rejected
  assert.throws(
    () => normalizeAdapterConfig({ endpoint: 'https://attacker.example/models' }, { provider: 'deepseek' }),
    /adapter endpoint host "attacker.example" does not match known provider domain for "deepseek"/
  )

  // Built-in openai adapter targeted to external host must be rejected
  assert.throws(
    () => normalizeAdapterConfig({ endpoint: 'https://evil.site/v1/models' }, { provider: 'openai' }),
    /adapter endpoint host "evil.site" does not match known provider domain for "openai"/
  )

  // Allowed if domain matches
  const validDeepSeek = normalizeAdapterConfig(
    { endpoint: 'https://api.deepseek.com/models' },
    { provider: 'deepseek' }
  )
  assert.equal(validDeepSeek.endpoint, 'https://api.deepseek.com/models')

  // Allowed on loopback for local testing/reverse proxy
  const loopbackDeepSeek = normalizeAdapterConfig(
    { endpoint: 'http://127.0.0.1:8080/models' },
    { provider: 'deepseek' }
  )
  assert.equal(loopbackDeepSeek.endpoint, 'http://127.0.0.1:8080/models')

  // Allowed with explicit opt-in allowCustomHost
  const explicitOptIn = normalizeAdapterConfig(
    { endpoint: 'https://my-internal-proxy.corp/models', allowCustomHost: true },
    { provider: 'deepseek' }
  )
  assert.equal(explicitOptIn.endpoint, 'https://my-internal-proxy.corp/models')

  // Custom provider (not in known built-in list) can use custom host
  const customProvider = normalizeAdapterConfig(
    { endpoint: 'https://my-llm.example/v1/models' },
    { provider: 'my-custom-provider' }
  )
  assert.equal(customProvider.endpoint, 'https://my-llm.example/v1/models')
})

test('issue #204: diffWebhookSecretRef schema has credential-ref role and resolves secret', async () => {
  // Verify Config schema includes diffWebhookSecretRef with role credential-ref
  const dict = Config.dict
  assert.ok(dict.diffWebhookSecretRef, 'diffWebhookSecretRef exists in Config schema')
  assert.equal(dict.diffWebhookSecretRef.meta?.role, 'credential-ref')
  assert.equal(dict.diffWebhookSecret.meta?.role, 'credential-ref')

  // Test dispatchDiffNotifications resolves diffWebhookSecretRef
  const resolvedCalls = []
  const fetchCalls = []
  const ctx = {
    logger: { debug: () => {} },
    credentials: {
      resolve: async (ref) => {
        resolvedCalls.push(ref)
        if (ref === 'MY_WEBHOOK_SECRET') return 'resolved-super-secret'
        return ''
      },
    },
  }

  const config = {
    diffWebhookUrl: 'https://webhook.example/hook',
    diffWebhookSecretRef: 'MY_WEBHOOK_SECRET',
    diffWebhookSecret: '',
    notifyOnModelAdded: true,
  }

  const results = [
    {
      provider: 'deepseek',
      diff: {
        added: [{ id: 'deepseek-v4', name: 'DeepSeek V4' }],
        removed: [],
        updated: [],
        deprecated: [],
        priceChanged: [],
      },
    },
  ]

  const res = await dispatchDiffNotifications(ctx, config, results, {
    fetchImpl: async (url, opts) => {
      fetchCalls.push({ url, opts })
      return new Response('OK', { status: 200 })
    },
  })

  assert.equal(res.ok, true)
  assert.deepEqual(resolvedCalls, ['MY_WEBHOOK_SECRET'])
  assert.equal(fetchCalls.length, 1)
  assert.ok(fetchCalls[0].opts.headers['x-hub-signature-256'])
})

test('issue #205: rejects SSRF attempts in webhook test and notifications', async () => {
  // Reject AWS metadata IP
  const metaRes = await sendWebhookNotification('http://169.254.169.254/latest/meta-data/', '', {})
  assert.equal(metaRes.ok, false)
  assert.match(metaRes.error, /forbidden metadata or link-local/)

  // Reject GCP metadata domain
  const gcpRes = await sendWebhookNotification('http://metadata.google.internal/computeMetadata/v1/', '', {})
  assert.equal(gcpRes.ok, false)
  assert.match(gcpRes.error, /forbidden metadata or link-local/)

  // Reject insecure HTTP outside loopback
  const httpExtRes = await sendWebhookNotification('http://external.site/webhook', '', {})
  assert.equal(httpExtRes.ok, false)
  assert.match(httpExtRes.error, /insecure http webhook url is only permitted on loopback/)

  // Allow HTTPS to external site
  let fetchedUrl = null
  const httpsRes = await sendWebhookNotification('https://example.com/webhook', '', { test: true }, {
    fetchImpl: async (url) => {
      fetchedUrl = url
      return new Response('OK', { status: 200 })
    },
  })
  assert.equal(httpsRes.ok, true)
  assert.equal(fetchedUrl, 'https://example.com/webhook')

  // Allow HTTP to loopback
  const loopbackRes = await sendWebhookNotification('http://127.0.0.1:9000/webhook', '', { test: true }, {
    fetchImpl: async (url) => {
      fetchedUrl = url
      return new Response('OK', { status: 200 })
    },
  })
  assert.equal(loopbackRes.ok, true)
  assert.equal(fetchedUrl, 'http://127.0.0.1:9000/webhook')
})

test('issue #214 / #215: updater does not pass --config.minimumReleaseAge=0 in installExact', () => {
  // Verify that installExact code does not pass --config.minimumReleaseAge=0
  const updaterSrc = installExact.toString()
  assert.ok(!updaterSrc.includes('minimumReleaseAge=0'), 'minimumReleaseAge=0 must not be in updater')
})

test('issue #218: GET /export and /credentials require loopback; /status allowed from LAN', async () => {
  const routes = new Map()
  const ctx = {
    webServer: {
      register: (route) => {
        routes.set(route.path, route.handler)
        return () => {}
      },
    },
  }
  const sync = {
    status: () => ({ running: false, lastRun: null }),
    listProviders: () => ['deepseek'],
    exportConfig: () => ({ version: 1, exported: true }),
    credentialDiagnostics: async () => [{ ref: 'KEY', configured: true }],
  }

  registerHttpApi(ctx, sync)

  const createMockRes = () => ({
    status: 0,
    headers: {},
    body: '',
    writeHead(s, h) { this.status = s; this.headers = h },
    end(b) { this.body = b ?? '' },
  })

  // 1. GET /status from LAN IP (no origin/referer) should succeed (status is public/monitoring)
  const statusRes = createMockRes()
  const lanReqStatus = {
    method: 'GET',
    url: '/dsh-model-sync/status',
    socket: { remoteAddress: '192.168.1.55' },
    headers: { host: '192.168.1.111:3080' },
  }
  await routes.get('/dsh-model-sync/status')(lanReqStatus, statusRes)
  assert.equal(statusRes.status, 200)

  // 2. GET /export from LAN IP without origin must be rejected with 403 Forbidden
  const exportRes = createMockRes()
  const lanReqExport = {
    method: 'GET',
    url: '/dsh-model-sync/export',
    socket: { remoteAddress: '192.168.1.55' },
    headers: { host: '192.168.1.111:3080' },
  }
  await routes.get('/dsh-model-sync/export')(lanReqExport, exportRes)
  assert.equal(exportRes.status, 403)
  assert.equal(JSON.parse(exportRes.body).error.code, 'forbidden')

  // 3. GET /credentials from LAN IP without origin must be rejected with 403 Forbidden
  const credsRes = createMockRes()
  const lanReqCreds = {
    method: 'GET',
    url: '/dsh-model-sync/credentials',
    socket: { remoteAddress: '192.168.1.55' },
    headers: { host: '192.168.1.111:3080' },
  }
  await routes.get('/dsh-model-sync/credentials')(lanReqCreds, credsRes)
  assert.equal(credsRes.status, 403)
  assert.equal(JSON.parse(credsRes.body).error.code, 'forbidden')

  // 4. GET /export from loopback IP must succeed with 200
  const loopbackExportRes = createMockRes()
  const loopbackReqExport = {
    method: 'GET',
    url: '/dsh-model-sync/export',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:3080' },
  }
  await routes.get('/dsh-model-sync/export')(loopbackReqExport, loopbackExportRes)
  assert.equal(loopbackExportRes.status, 200)
  assert.equal(JSON.parse(loopbackExportRes.body).exported, true)
})
