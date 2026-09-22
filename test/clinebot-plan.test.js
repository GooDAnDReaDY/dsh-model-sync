import test from 'node:test'
import assert from 'node:assert/strict'
import { createProviderAdapterRegistry } from '../lib/adapter-registry.js'
import { parseClinePassModels } from '../lib/models.js'

test('clinebot: parseClinePassModels parses array of features and maps to 11 models', () => {
  const features = [
    'Low cost subscription pricing',
    'Generous limits and reliable access',
    'Includes Kimi K3, GLM 5.2, Kimi K2.6, Kimi K2.7 Code, Mimo v2.5, Mimo v2.5 Pro, Minimax M3, Qwen3.7 Plus, Qwen3.7 Max, DeepSeek V4 Pro, and DeepSeek V4 Flash',
  ]

  const models = parseClinePassModels(features)
  assert.equal(models.length, 11)
  assert.ok(models.some((m) => m.id === 'cline-pass/deepseek-v4-flash'))
  assert.ok(models.some((m) => m.id === 'cline-pass/kimi-k3'))
  assert.ok(models.some((m) => m.id === 'cline-pass/mimo-v2.5'))
  // Ensure non-subscription models are NOT included
  assert.ok(!models.some((m) => m.id === 'cline-pass/claude-3-7-sonnet'))
  assert.ok(!models.some((m) => m.id === 'cline-pass/gpt-4.5-preview'))
})

test('clinebot: adapter queries /users/me/plan and extracts subscription models', async () => {
  let capturedUrl
  let capturedHeaders
  const mockPlanPayload = {
    data: {
      plan: {
        id: 'pln-01KSJCW4BF730CP27KRA82CFDN',
        displayName: 'Cline Pass (Monthly)',
        features: {
          included: [
            'Includes Kimi K3, GLM 5.2, Kimi K2.6, Kimi K2.7 Code, Mimo v2.5, Mimo v2.5 Pro, Minimax M3, Qwen3.7 Plus, Qwen3.7 Max, DeepSeek V4 Pro, and DeepSeek V4 Flash',
          ],
        },
      },
    },
  }

  const registry = createProviderAdapterRegistry({
    resolveCredential: async (ref) => {
      assert.equal(ref, 'CLINEBOT_API_KEY')
      return 'cline-key-123'
    },
    fetchImpl: async (url, options) => {
      capturedUrl = String(url)
      capturedHeaders = options?.headers
      return new Response(JSON.stringify(mockPlanPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  const adapter = registry.select({ provider: 'clinebot', apiKeyEnv: 'CLINEBOT_API_KEY' })
  assert.ok(adapter, 'ClineBot dedicated plan adapter must be selected')

  const rows = await adapter.discover({ provider: 'clinebot', apiKeyEnv: 'CLINEBOT_API_KEY' })
  assert.equal(capturedUrl, 'https://api.cline.bot/api/v1/users/me/plan')
  assert.equal(capturedHeaders.Authorization, 'Bearer cline-key-123')
  assert.equal(rows.length, 11, 'Must return exactly 11 plan models, never 446 models')
  assert.ok(rows.some((m) => m.id === 'cline-pass/deepseek-v4-flash'))
  assert.ok(rows.some((m) => m.id === 'cline-pass/glm-5.2'))
})
