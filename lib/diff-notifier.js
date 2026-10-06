import { createHmac } from "node:crypto"

export function extractDiffEvents(results, options = {}) {
  const notifyOnModelAdded = options.notifyOnModelAdded !== false
  const notifyOnModelDeprecated = options.notifyOnModelDeprecated !== false
  const notifyOnPriceChanged = options.notifyOnPriceChanged !== false

  const added = []
  const deprecated = []
  const priceChanged = []

  const rows = Array.isArray(results) ? results : []
  for (const row of rows) {
    const provider = String(row?.provider ?? "")
    const diff = row?.diff ?? {}

    if (notifyOnModelAdded && Array.isArray(diff.added)) {
      for (const model of diff.added) {
        if (!model?.id) continue
        added.push({
          provider,
          id: model.id,
          name: model.name || model.id,
          ...(model.contextWindow !== undefined ? { contextWindow: model.contextWindow } : {}),
          ...(model.pricing ? { pricing: model.pricing } : {}),
        })
      }
    }

    if (notifyOnModelDeprecated) {
      if (Array.isArray(diff.removed)) {
        for (const model of diff.removed) {
          if (!model?.id) continue
          deprecated.push({
            provider,
            id: model.id,
            name: model.name || model.id,
            reason: "removed",
          })
        }
      }
      if (Array.isArray(diff.changed)) {
        for (const pair of diff.changed) {
          const beforeDep = pair?.before?.lifecycle?.deprecated === true
          const afterDep = pair?.after?.lifecycle?.deprecated === true
          const beforeDate = pair?.before?.lifecycle?.deprecationDate
          const afterDate = pair?.after?.lifecycle?.deprecationDate
          if ((afterDep && !beforeDep) || (afterDate && afterDate !== beforeDate)) {
            deprecated.push({
              provider,
              id: pair.after.id,
              name: pair.after.name || pair.after.id,
              reason: "deprecated",
              ...(afterDate ? { deprecationDate: afterDate } : {}),
            })
          }
        }
      }
      if (Array.isArray(row?.stale)) {
        for (const model of row.stale) {
          if (!model?.id) continue
          deprecated.push({
            provider,
            id: model.id,
            name: model.name || model.id,
            reason: "stale",
          })
        }
      }
    }

    if (notifyOnPriceChanged && Array.isArray(diff.changed)) {
      for (const pair of diff.changed) {
        const bp = pair?.before?.pricing
        const ap = pair?.after?.pricing
        if (bp || ap) {
          const inputDiff = bp?.inputPerToken !== ap?.outputPerToken && bp?.inputPerToken !== ap?.inputPerToken
          const outputDiff = bp?.outputPerToken !== ap?.outputPerToken
          if (inputDiff || outputDiff) {
            priceChanged.push({
              provider,
              id: pair.after.id,
              name: pair.after.name || pair.after.id,
              oldPricing: bp || null,
              newPricing: ap || null,
            })
          }
        }
      }
    }
  }

  return {
    hasEvents: added.length > 0 || deprecated.length > 0 || priceChanged.length > 0,
    timestamp: Date.now(),
    counts: {
      added: added.length,
      deprecated: deprecated.length,
      priceChanged: priceChanged.length,
    },
    added,
    deprecated,
    priceChanged,
  }
}

export async function sendWebhookNotification(url, secret, payload, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  if (typeof url !== "string" || !url.trim()) {
    return { ok: false, error: "URL is required" }
  }
  let parsedUrl
  try {
    parsedUrl = new URL(url.trim())
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { ok: false, error: "URL must use http or https protocol" }
    }
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (
      hostname === '169.254.169.254' ||
      hostname.startsWith('169.254.') ||
      hostname === 'metadata.google.internal' ||
      hostname === '0.0.0.0' ||
      hostname === '255.255.255.255'
    ) {
      return { ok: false, error: "webhook url targets a forbidden metadata or link-local address" }
    }
    const isLoopback = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.') || hostname.startsWith('::ffff:127.')
    if (parsedUrl.protocol === "http:" && !isLoopback) {
      return { ok: false, error: "insecure http webhook url is only permitted on loopback" }
    }
  } catch (err) {
    return { ok: false, error: "Invalid URL: " + (err?.message || String(err)) }
  }

  const body = JSON.stringify(payload)
  const headers = {
    "content-type": "application/json",
    "user-agent": "dsh-model-sync/diff-notifier",
  }
  if (secret && typeof secret === "string" && secret.trim()) {
    const signature = createHmac("sha256", secret.trim()).update(body).digest("hex")
    headers["x-hub-signature-256"] = "sha256=" + signature
    headers["x-signature"] = signature
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(new Error("Webhook request timed out")), timeoutMs) : null

  try {
    const res = await fetchImpl(parsedUrl.toString(), {
      method: "POST",
      headers,
      body,
      ...(controller ? { signal: controller.signal } : {}),
    })
    if (timer) clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch (err) {
    if (timer) clearTimeout(timer)
    return { ok: false, error: err?.message || String(err) }
  }
}

export async function dispatchDiffNotifications(ctx, config, results, { fetchImpl = globalThis.fetch } = {}) {
  const events = extractDiffEvents(results, config)
  if (!events.hasEvents) {
    return { ok: true, events, dispatched: false }
  }

  try {
    if (typeof ctx?.emit === "function") {
      ctx.emit("model-sync/diff", events)
    }
  } catch (err) {
    if (typeof ctx?.logger?.debug === "function") {
      ctx.logger.debug("[dsh-model-sync] emit model-sync/diff error:", err)
    }
  }

  try {
    if (typeof ctx?.pluginNotify?.send === "function") {
      const summary = `Model Sync: +${events.counts.added} added, -${events.counts.deprecated} deprecated, ~${events.counts.priceChanged} price changed`
      await ctx.pluginNotify.send({
        source: "dsh-model-sync",
        title: "Model Sync Catalog Changes",
        message: summary,
        data: events,
      })
    }
  } catch (err) {
    if (typeof ctx?.logger?.debug === "function") {
      ctx.logger.debug("[dsh-model-sync] pluginNotify error:", err)
    }
  }

  let webhookResult = null
  if (config?.diffWebhookUrl && typeof config.diffWebhookUrl === "string" && config.diffWebhookUrl.trim()) {
    let secret = config.diffWebhookSecret || ''
    const secretRef = config.diffWebhookSecretRef || (typeof config.diffWebhookSecret === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(config.diffWebhookSecret) ? config.diffWebhookSecret : '')
    if (secretRef) {
      try {
        const res = await (ctx?.credentials?.resolve ? ctx.credentials.resolve(secretRef) : ctx?.get?.('credentials')?.resolve?.(secretRef))
        if (res) secret = typeof res === 'string' ? res : res?.value || secret
      } catch (err) {
        if (typeof ctx?.logger?.debug === 'function') {
          ctx.logger.debug('[dsh-model-sync] webhook secret resolution fallback:', err)
        }
      }
    }
    webhookResult = await sendWebhookNotification(
      config.diffWebhookUrl,
      secret,
      {
        event: "model-sync.diff",
        ...events,
      },
      { fetchImpl }
    )
  }

  return { ok: true, events, dispatched: true, webhook: webhookResult }
}
