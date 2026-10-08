import test from "node:test"
import assert from "node:assert/strict"
import {
  isRetryableError,
  retryWithBackoff,
  catalogRequestError,
} from "../lib/reliability.js"
import { createModelSynchronizer } from "../lib/synchronizer.js"
import { createModelProber } from "../lib/synchronizer-prober.js"
import { resolveAlias } from "../lib/alias-resolver.js"
import { normalizeModel } from "../lib/models.js"
import { listApiKeyProviders } from "../lib/inventory.js"
import { canUseGenericAdapter, discoverOpenAIModels } from "../lib/generic-adapter.js"
import { createProviderAdapterRegistry } from "../lib/adapter-registry.js"
import { sendWebhookNotification } from "../lib/diff-notifier.js"

test("#239: native fetch error causes classified as retryable and trigger circuit failures", async () => {
  // 1. TypeError fetch failed with cause.code UND_ERR_SOCKET
  const socketError = new TypeError("fetch failed")
  socketError.cause = { code: "UND_ERR_SOCKET", message: "other side closed" }
  assert.equal(isRetryableError(socketError), true)

  // 2. Nested cause with ECONNRESET
  const resetError = new TypeError("fetch failed")
  resetError.cause = { cause: { code: "ECONNRESET" } }
  assert.equal(isRetryableError(resetError), true)

  // 3. Undici connection/header/body timeout codes
  const timeoutCodeErr = new TypeError("fetch failed")
  timeoutCodeErr.cause = { code: "UND_ERR_HEADERS_TIMEOUT" }
  assert.equal(isRetryableError(timeoutCodeErr), true)

  // 4. Distinction: caller cancellation (AbortError without timeout) is NOT retryable
  const abortErr = new Error("operation aborted")
  abortErr.name = "AbortError"
  assert.equal(isRetryableError(abortErr), false)

  // 5. TimeoutError IS retryable
  const timeoutErr = new Error("request timed out")
  timeoutErr.name = "TimeoutError"
  assert.equal(isRetryableError(timeoutErr), true)

  // 6. Permanent 4xx (400, 401, 403, 404) are NOT retryable
  assert.equal(isRetryableError(catalogRequestError(400)), false)
  assert.equal(isRetryableError(catalogRequestError(401)), false)
  assert.equal(isRetryableError(catalogRequestError(403)), false)
  assert.equal(isRetryableError(catalogRequestError(404)), false)

  // 7. Transient socket reset gives 3 attempts in retryWithBackoff
  let attempts = 0
  await assert.rejects(async () => {
    await retryWithBackoff(async () => {
      attempts++
      throw socketError
    }, { attempts: 3, baseDelayMs: 0, maxDelayMs: 0 })
  }, (err) => err === socketError)
  assert.equal(attempts, 3)
})

test("#240: Retry-After delay is not clamped by local maxDelayMs cap and handles excessive delay", async () => {
  let capturedDelay = 0
  const controller = new AbortController()

  // Simulated server demanding 60s delay (60,000ms), local maxDelayMs is 4,000ms
  const err60s = catalogRequestError(429, {
    headers: new Map([["retry-after", "60"]]),
  })
  assert.equal(err60s.retryAfterMs, 60000)
  assert.ok(err60s.retryAt)

  // Abort inside onRetry so delayMs is calculated and wait is cancelled immediately
  await assert.rejects(async () => {
    await retryWithBackoff(async () => {
      throw err60s
    }, {
      attempts: 2,
      maxDelayMs: 4000,
      signal: controller.signal,
      onRetry: ({ delayMs }) => {
        capturedDelay = delayMs
        controller.abort()
      },
    })
  }, (err) => err.name === "AbortError")

  // delayMs was NOT clamped to 4000; it respected server's 60000
  assert.equal(capturedDelay, 60000)

  // Excessive Retry-After (> maxRetryAfterMs ceiling of 5 min) throws immediately
  const err10m = catalogRequestError(429, {
    headers: new Map([["retry-after", "600"]]), // 10 minutes = 600,000ms
  })
  assert.equal(err10m.retryAfterMs, 600000)

  let onRetryCalled = false
  await assert.rejects(async () => {
    await retryWithBackoff(async () => {
      throw err10m
    }, {
      attempts: 3,
      maxDelayMs: 4000,
      maxRetryAfterMs: 300000, // 5 min ceiling
      onRetry: () => { onRetryCalled = true },
    })
  }, (err) => err === err10m && Boolean(err.retryAt))

  assert.equal(onRetryCalled, false, "should throw immediately without retrying or busy waiting")
})

test("#241: HTTP responses and webhooks release/cancel response body on error and 304", async () => {
  let genericBodyCancelled = 0
  let webhookBodyCancelled = 0

  // 1. generic-adapter non-2xx cancels body
  const mockGenericFetch = async () => ({
    status: 503,
    ok: false,
    headers: new Map(),
    body: {
      cancel: async () => {
        genericBodyCancelled++
      },
    },
  })

  await assert.rejects(async () => {
    await discoverOpenAIModels(
      { provider: "test", baseURL: "http://localhost:9999", api: "openai-completions" },
      { fetchImpl: mockGenericFetch }
    )
  }, /HTTP 503/)
  assert.equal(genericBodyCancelled, 1, "generic adapter should cancel body on non-2xx")

  // 2. webhook response cancels body
  const mockWebhookFetch = async () => ({
    status: 503,
    ok: false,
    body: {
      cancel: async () => {
        webhookBodyCancelled++
      },
    },
  })

  const hookResult = await sendWebhookNotification(
    "http://127.0.0.1:9999/hook",
    "secret",
    { test: 1 },
    { fetchImpl: mockWebhookFetch }
  )
  assert.equal(hookResult.ok, false)
  assert.equal(hookResult.status, 503)
  assert.equal(webhookBodyCancelled, 1, "webhook notification should cancel body on response")
})

test("#233: smart strategy aliases exclude failed health providers and report honest empty state", () => {
  const modelCatalogs = {
    providerA: [{ id: "model-a-fast", pricing: { inputPerToken: 1, outputPerToken: 2 } }],
    providerB: [{ id: "model-b-fast", pricing: { inputPerToken: 10, outputPerToken: 20 } }],
  }

  // providerA is cheapest, BUT its health failed
  const healthResults = [
    { provider: "providerA", status: "error", message: "connect ECONNREFUSED" },
    { provider: "providerB", status: "ok" },
  ]

  // @cheap must NOT select providerA
  const resolvedCheap = resolveAlias("@cheap", {
    modelCatalogs,
    healthResults,
    isCircuitOpen: () => false,
  })
  assert.equal(resolvedCheap.provider, "providerB", "failed providerA must be excluded by @cheap")

  // @fast must NOT select providerA
  const resolvedFast = resolveAlias("@fast", {
    modelCatalogs,
    healthResults,
    isCircuitOpen: () => false,
  })
  assert.equal(resolvedFast.provider, "providerB", "failed providerA must be excluded by @fast")

  // When all providers are unhealthy, returns NO_HEALTHY_MODELS
  const allUnhealthyResults = [
    { provider: "providerA", status: "error" },
    { provider: "providerB", status: "circuit-open" },
  ]
  const resolvedAllFailed = resolveAlias("@cheap", {
    modelCatalogs,
    healthResults: allUnhealthyResults,
    isCircuitOpen: (p) => p === "providerB",
  })
  assert.equal(resolvedAllFailed.error, "NO_HEALTHY_MODELS")
  assert.equal(resolvedAllFailed.resolved, null)
})

test("#234: explicit capability=false is preserved and not overridden by model name heuristics", () => {
  // Model name has 'coder', 'reasoning', 'vision', but capabilities explicitly set all to false
  const normalized = normalizeModel("demo", {
    id: "deepseek-coder-reasoning-vision",
    capabilities: {
      code: false,
      reasoning: false,
      vision: false,
    },
  })

  assert.equal(normalized.capabilities.code, false, "explicit code: false must remain false")
  assert.equal(normalized.capabilities.reasoning, false, "explicit reasoning: false must remain false")
  assert.equal(normalized.capabilities.vision, false, "explicit vision: false must remain false")

  // When capabilities are omitted (undefined), heuristics apply
  const heuristicModel = normalizeModel("demo", {
    id: "deepseek-coder-reasoning-vision",
  })
  assert.equal(heuristicModel.capabilities.code, true)
  assert.equal(heuristicModel.capabilities.reasoning, true)
  assert.equal(heuristicModel.capabilities.vision, true)
})

test("#236: standalone llm-commandcode in settings is marked configured=true", () => {
  const llm = {
    listConfigurableProviders: () => [
      {
        provider: "commandcode",
        displayName: "Command Code",
        settingsNs: "llm-commandcode",
        declared: false,
      },
    ],
    listProviders: () => [],
  }

  // Case 1: settings has llm-commandcode configured
  const configuredSettings = {
    describe: () => [
      {
        ns: "llm-commandcode",
        value: {
          apiKeyEnv: "CC_DUMMY",
          visibleModels: ["cmd-code-v1"],
        },
      },
    ],
  }
  const [configuredRow] = listApiKeyProviders(llm, configuredSettings)
  assert.equal(configuredRow.provider, "commandcode")
  assert.equal(configuredRow.configured, true, "standalone configured commandcode must have configured: true")

  // Case 2: settings has empty/missing llm-commandcode
  const unconfiguredSettings = {
    describe: () => [],
  }
  const [unconfiguredRow] = listApiKeyProviders(llm, unconfiguredSettings)
  assert.equal(unconfiguredRow.provider, "commandcode")
  assert.equal(unconfiguredRow.configured, false, "missing commandcode must have configured: false")
})

test("#195: tryModel and batchTryModels execute model inference probes and measure individual latencies", async () => {
  const probedModels = []

  const mockProbeModel = async ({ provider, model }) => {
    probedModels.push({ provider, model })
    if (model === "model-forbidden") {
      const err = new Error("403 Forbidden - Quota exceeded")
      err.status = 403
      throw err
    }
    if (model === "model-fast") {
      return { ok: true }
    }
    return { ok: true }
  }

  const catalog = [
    { id: "model-fast" },
    { id: "model-forbidden" },
    { id: "model-slow" },
  ]

  const prober = createModelProber({
    probeModel: mockProbeModel,
    getProviderCatalog: () => catalog,
  })

  // 1. tryModel passes exact model to probe and succeeds
  const resFast = await prober.tryModel({ provider: "demo", model: "model-fast" })
  assert.equal(resFast.ok, true)
  assert.equal(resFast.model, "model-fast")
  assert.equal(typeof resFast.latencyMs, "number")

  // 2. Catalog 200 + inference 403 reports model failure
  const resForbidden = await prober.tryModel({ provider: "demo", model: "model-forbidden" })
  assert.equal(resForbidden.ok, false)
  assert.equal(resForbidden.model, "model-forbidden")
  assert.equal(resForbidden.status, "http_403")

  // 3. batchTryModels probes each model with bounded concurrency and reports true summary
  probedModels.length = 0
  const batchRes = await prober.batchTryModels({
    provider: "demo",
    models: ["model-fast", "model-forbidden", "model-slow"],
    concurrency: 2,
  })

  assert.equal(batchRes.summary.total, 3)
  assert.equal(batchRes.summary.reachable, 2)
  assert.equal(batchRes.summary.unreachable, 1)
  assert.deepEqual(
    probedModels.map((p) => p.model).sort(),
    ["model-fast", "model-forbidden", "model-slow"].sort()
  )
})