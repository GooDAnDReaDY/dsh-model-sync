import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { ReadableStream } from "node:stream/web"

import { readBoundedText, MAX_RESPONSE_BYTES } from "../lib/generic-adapter.js"
import { normalizeModels } from "../lib/models.js"
import { createConfigTransfer } from "../lib/synchronizer-transfer.js"
import { retryWithBackoff } from "../lib/reliability.js"
import { resolveAlias } from "../lib/alias-resolver.js"
import { trusted } from "../lib/http.js"

test("#210: readBoundedText rejects declared content-length exceeding MAX_RESPONSE_BYTES before reading body", async () => {
  let bodyRead = false
  const fakeResponse = {
    headers: new Headers({ "content-length": String(MAX_RESPONSE_BYTES + 100) }),
    body: {
      [Symbol.asyncIterator]: async function* () {
        bodyRead = true
        yield Buffer.from("chunk")
      }
    }
  }
  await assert.rejects(
    async () => readBoundedText(fakeResponse, MAX_RESPONSE_BYTES),
    /model catalog response is too large/
  )
  assert.equal(bodyRead, false, "must not read stream body if content-length header already exceeds limit")
})

test("#210: readBoundedText streams and aborts chunked stream when total bytes exceed limit", async () => {
  let chunksYielded = 0
  let cancelled = false
  const stream = new ReadableStream({
    pull(controller) {
      chunksYielded += 1
      controller.enqueue(Buffer.alloc(1024 * 1024, "x"))
    },
    cancel() {
      cancelled = true
    }
  })

  await assert.rejects(
    async () => readBoundedText({ body: stream }, MAX_RESPONSE_BYTES),
    /model catalog response is too large/
  )
  assert.equal(cancelled, true, "must cancel stream upon exceeding limit")
  assert.ok(chunksYielded <= 6, "must stop pulling chunks immediately after limit exceeded")
})

test("#210: readBoundedText successfully reads valid streaming response within limit", async () => {
  const content = JSON.stringify({ data: [{ id: "m1", name: "Model One" }] })
  const response = new Response(content)
  const result = await readBoundedText(response, MAX_RESPONSE_BYTES)
  assert.equal(result, content)
})

test("#211: vision heuristic accurately sets vision for vision/vl and avoids dead outer branches", () => {
  const models = normalizeModels("test-provider", [
    { id: "model-vision-v1", name: "Vision V1" },
    { id: "qwen-vl-max", name: "Qwen VL Max" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gemini-flash", name: "Gemini Flash" },
  ])

  const visionV1 = models.find(m => m.id === "model-vision-v1")
  assert.equal(visionV1.capabilities?.vision, true)

  const qwenVl = models.find(m => m.id === "qwen-vl-max")
  assert.equal(qwenVl.capabilities?.vision, true)

  const gpt4o = models.find(m => m.id === "gpt-4o")
  assert.equal(gpt4o.capabilities?.vision, undefined)

  const flash = models.find(m => m.id === "gemini-flash")
  assert.equal(flash.capabilities?.vision, undefined)
})

test("#212: importConfig sanitizes, dedupes, trims, and caps selectedModels array", async () => {
  let savedConfig = null
  const transfer = createConfigTransfer({
    getConfig: () => ({ modelPolicies: {}, modelSelections: {}, aliases: {} }),
    saveConfig: async (cfg) => { savedConfig = cfg },
    providers: () => [{ provider: "demo", configured: true }],
    validatePolicy: p => p,
  })

  // Create an array with duplicates, whitespace, non-strings, and 1200 entries
  const oversizedArray = [
    "  model-a  ",
    "model-a",
    null,
    123,
    "",
    ...Array.from({ length: 1200 }, (_, i) => "m-" + i)
  ]

  const result = await transfer.importConfig({
    providers: {
      demo: { selectedModels: oversizedArray }
    }
  })

  assert.ok(result.importedProviders.includes("demo"))
  const selections = savedConfig.modelSelections.demo
  assert.equal(selections[0], "model-a")
  assert.equal(selections.includes(""), false)
  assert.equal(selections.includes(null), false)
  // Ensure duplicates removed
  assert.equal(selections.filter(m => m === "model-a").length, 1)
  // Ensure capped at 1000
  assert.ok(selections.length <= 1000)
  assert.equal(selections.length, 1000)
})

test("#213: retryWithBackoff propagates last error without unreachable throw", async () => {
  let attemptsMade = 0
  await assert.rejects(
    async () => retryWithBackoff(async () => {
      attemptsMade += 1
      const err = new Error("rate limit")
      err.status = 429
      throw err
    }, { attempts: 2, baseDelayMs: 1, jitter: false }),
    /rate limit/
  )
  assert.equal(attemptsMade, 2)
})

test("#213: alias resolver resolves code model without unused provider parameter", () => {
  const models = [
    { id: "qwen-2.5-coder-32b", name: "Qwen Coder", capabilities: { code: true } },
    { id: "generic-model", name: "Generic" }
  ]
  const result = resolveAlias("@best-code", {
    modelCatalogs: { prov1: models }
  })
  assert.equal(result.model, "qwen-2.5-coder-32b")
  assert.equal(result.strategy, "best-code")
})

test("#213: trusted HTTP check correctly permits loopback and blocks untrusted", () => {
  assert.equal(trusted({ socket: { remoteAddress: "127.0.0.1" }, method: "POST", headers: { host: "localhost:3000" } }), true)
  assert.equal(trusted({ socket: { remoteAddress: "192.168.1.50" }, method: "POST", headers: { host: "192.168.1.111:3000" } }), false)
})

test("#216: package.json declares credentials, host-webserver, and settings peerDependencies", () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"))
  const peers = pkg.peerDependencies || {}
  const expectedRange = "^0.1.7-rc.2 || ^0.2.0-rc.1 || >=0.2.1-alpha.1"
  assert.equal(peers["@deepseek-ai/dsh-credentials"], expectedRange)
  assert.equal(peers["@deepseek-ai/dsh-host-webserver"], expectedRange)
  assert.equal(peers["@deepseek-ai/dsh-settings"], expectedRange)
  assert.ok(peers["@deepseek-ai/dsh-llm"])
})

test("#217: lib/client.js contains zero non-canonical theme tokens", () => {
  const clientSrc = fs.readFileSync(path.resolve("lib/client.js"), "utf8")
  const forbiddenPatterns = [
    /var\(--dsw-alias-border-primary\)/,
    /var\(--dsw-alias-state-brand-primary\)/,
    /var\(--dsw-alias-state-success\)(?!-)/,
    /var\(--dsw-alias-state-warning-primary\)/,
    /var\(--dsw-alias-state-warning-secondary\)/
  ]
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(clientSrc), false, "Forbidden non-canonical token found in client.js matching " + pattern)
  }
})
