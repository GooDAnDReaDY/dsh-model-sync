import test from "node:test"
import assert from "node:assert/strict"
import { extractDiffEvents, sendWebhookNotification, dispatchDiffNotifications } from "../lib/diff-notifier.js"

test("extractDiffEvents extracts added models correctly", () => {
  const results = [
    {
      provider: "openrouter",
      diff: {
        added: [
          { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", contextWindow: 200000, pricing: { inputPerToken: 0.000003, outputPerToken: 0.000015 } },
        ],
      },
    },
  ]
  const events = extractDiffEvents(results)
  assert.equal(events.hasEvents, true)
  assert.equal(events.counts.added, 1)
  assert.equal(events.added[0].id, "anthropic/claude-3.5-sonnet")
  assert.equal(events.added[0].provider, "openrouter")

  const disabled = extractDiffEvents(results, { notifyOnModelAdded: false })
  assert.equal(disabled.hasEvents, false)
  assert.equal(disabled.counts.added, 0)
})

test("extractDiffEvents extracts deprecated and removed models", () => {
  const results = [
    {
      provider: "deepseek",
      diff: {
        removed: [{ id: "deepseek-coder", name: "DeepSeek Coder" }],
        changed: [
          {
            before: { id: "deepseek-chat", lifecycle: { deprecated: false } },
            after: { id: "deepseek-chat", lifecycle: { deprecated: true, deprecationDate: "2026-10-01" } },
          },
        ],
      },
      stale: [{ id: "deepseek-old", name: "DeepSeek Old" }],
    },
  ]
  const events = extractDiffEvents(results)
  assert.equal(events.hasEvents, true)
  assert.equal(events.counts.deprecated, 3)
  assert.deepEqual(events.deprecated.map((m) => m.id), ["deepseek-coder", "deepseek-chat", "deepseek-old"])

  const disabled = extractDiffEvents(results, { notifyOnModelDeprecated: false })
  assert.equal(disabled.hasEvents, false)
  assert.equal(disabled.counts.deprecated, 0)
})

test("extractDiffEvents extracts price changes", () => {
  const results = [
    {
      provider: "openai",
      diff: {
        changed: [
          {
            before: { id: "gpt-4o", pricing: { inputPerToken: 0.000005, outputPerToken: 0.000015 } },
            after: { id: "gpt-4o", pricing: { inputPerToken: 0.0000025, outputPerToken: 0.000010 } },
          },
          {
            before: { id: "gpt-4o-mini", pricing: { inputPerToken: 0.00000015 } },
            after: { id: "gpt-4o-mini", pricing: { inputPerToken: 0.00000015 } },
          },
        ],
      },
    },
  ]
  const events = extractDiffEvents(results)
  assert.equal(events.hasEvents, true)
  assert.equal(events.counts.priceChanged, 1)
  assert.equal(events.priceChanged[0].id, "gpt-4o")
  assert.equal(events.priceChanged[0].oldPricing.inputPerToken, 0.000005)
  assert.equal(events.priceChanged[0].newPricing.inputPerToken, 0.0000025)

  const disabled = extractDiffEvents(results, { notifyOnPriceChanged: false })
  assert.equal(disabled.hasEvents, false)
  assert.equal(disabled.counts.priceChanged, 0)
})

test("sendWebhookNotification sends POST with JSON body and HMAC signature", async () => {
  let captured = null
  const mockFetch = async (url, options) => {
    captured = { url, options }
    return { ok: true, status: 200 }
  }

  const res = await sendWebhookNotification("https://example.com/webhook", "my-secret-key", {
    event: "model-sync.diff",
    added: [{ id: "m1" }],
  }, { fetchImpl: mockFetch })

  assert.equal(res.ok, true)
  assert.equal(res.status, 200)
  assert.equal(captured.url, "https://example.com/webhook")
  assert.equal(captured.options.method, "POST")
  assert.equal(captured.options.headers["content-type"], "application/json")
  assert.ok(captured.options.headers["x-hub-signature-256"].startsWith("sha256="))
  assert.ok(captured.options.headers["x-signature"])
})

test("sendWebhookNotification validates URL and handles network errors", async () => {
  const invalidUrl = await sendWebhookNotification("ftp://not-supported", "secret", {})
  assert.equal(invalidUrl.ok, false)
  assert.match(invalidUrl.error, /http or https/)

  const failingFetch = async () => {
    throw new Error("Connection refused")
  }
  const failed = await sendWebhookNotification("http://localhost:9999/hook", "", {}, { fetchImpl: failingFetch })
  assert.equal(failed.ok, false)
  assert.match(failed.error, /Connection refused/)
})

test("dispatchDiffNotifications emits events and calls pluginNotify", async () => {
  let emitted = null
  let notified = null
  let webhookPayload = null

  const ctx = {
    emit: (event, data) => { emitted = { event, data } },
    pluginNotify: {
      send: async (payload) => { notified = payload },
    },
  }

  const mockFetch = async (url, options) => {
    webhookPayload = JSON.parse(options.body)
    return { ok: true, status: 200 }
  }

  const results = [
    {
      provider: "openrouter",
      diff: { added: [{ id: "new-model", name: "New Model" }] },
    },
  ]

  const config = {
    diffWebhookUrl: "https://example.com/hook",
    diffWebhookSecret: "test",
    notifyOnModelAdded: true,
  }

  const result = await dispatchDiffNotifications(ctx, config, results, { fetchImpl: mockFetch })
  assert.equal(result.ok, true)
  assert.equal(result.dispatched, true)
  assert.equal(emitted.event, "model-sync/diff")
  assert.equal(emitted.data.counts.added, 1)
  assert.equal(notified.source, "dsh-model-sync")
  assert.equal(webhookPayload.event, "model-sync.diff")
  assert.equal(webhookPayload.added[0].id, "new-model")
})
