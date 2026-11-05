/**
 * DeepSeek Harness Model Sync — Model Tagging & Smart Curation (#264, #277)
 */

export function deriveModelTags(model) {
  if (!model || typeof model !== "object") return []
  const tags = new Set(Array.isArray(model.tags) ? model.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim().toLowerCase()) : [])
  const idLower = String(model.id || "").toLowerCase()
  const nameLower = String(model.name || "").toLowerCase()
  const provLower = String(model.provider || "").toLowerCase()
  const capabilities = model.capabilities || {}

  // 1. coding
  if (
    capabilities.code === true ||
    idLower.includes("coder") ||
    idLower.includes("codestral") ||
    idLower.includes("starcoder") ||
    idLower.includes("deepseek-coder") ||
    idLower.includes("claude-3-7-sonnet") ||
    idLower.includes("claude-3-5-sonnet") ||
    idLower.includes("kimi-k2.7-code") ||
    idLower.includes("qwen-2.5-coder") ||
    idLower.includes("qwen2.5-coder") ||
    (/(^|[_-])(code|dev|prog)($|[_-])/i.test(idLower)) ||
    (/(^|[_-])(code|coder)($|[_-])/i.test(nameLower))
  ) {
    tags.add("coding")
  }

  // 2. reasoning
  if (
    model.reasoningConfig?.supportsReasoning === true ||
    capabilities.reasoning === true ||
    /(^|[_-])(o1|o3|r1|qwq)($|[_-])/i.test(idLower) ||
    idLower.includes("reasoner") ||
    idLower.includes("deepseek-r1") ||
    idLower.includes("thinking") ||
    idLower.includes("-r1")
  ) {
    tags.add("reasoning")
  }

  // 3. fast
  if (
    provLower === "groq" ||
    provLower === "cerebras" ||
    idLower.includes("flash") ||
    idLower.includes("mini") ||
    idLower.includes("instant") ||
    idLower.includes("haiku") ||
    idLower.includes("small") ||
    idLower.includes("8b") ||
    idLower.includes("3b") ||
    idLower.includes("1b") ||
    idLower.includes("turbo") ||
    idLower.includes("lite") ||
    idLower.includes("nano")
  ) {
    tags.add("fast")
  }

  // 4. vision
  if (
    capabilities.vision === true ||
    (Array.isArray(model.input) && model.input.includes("image")) ||
    idLower.includes("vision") ||
    idLower.includes("vl") ||
    idLower.includes("pixtral") ||
    idLower.includes("gemini") ||
    idLower.includes("claude-3") ||
    idLower.includes("4o")
  ) {
    tags.add("vision")
  }

  // 5. long-context (>= 128k tokens)
  if (typeof model.contextWindow === "number" && model.contextWindow >= 128000) {
    tags.add("long-context")
  }

  return [...tags].sort()
}

export function isCuratedModel(model) {
  if (!model || typeof model !== "object") return false
  if (model.lifecycle?.deprecated) return false
  const id = String(model.id || "").toLowerCase()
  if (/-(202\d{5}|202\d-\d{2}-\d{2}|\d{4})$/.test(id) && !id.includes("claude-3-7") && !id.includes("claude-3-5")) {
    return false
  }
  if (id.includes("-0314") || id.includes("-0613") || id.includes("-1106") || id.includes("-0125")) {
    return false
  }

  const curatedIds = [
    "claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku",
    "gpt-4o", "gpt-4o-mini", "o1", "o3-mini",
    "deepseek-chat", "deepseek-reasoner", "deepseek-v3", "deepseek-r1",
    "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
    "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama-3.1-70b-versatile",
    "qwen-2.5-coder-32b", "qwen-2.5-72b", "qwq-32b",
    "mistral-large", "codestral", "pixtral-large",
    "kimi-k2.7-code"
  ]

  for (const c of curatedIds) {
    if (id === c || id.endsWith("/" + c) || id.includes(c)) return true
  }

  const tags = model.tags || deriveModelTags(model)
  if (tags.includes("coding") && tags.includes("reasoning") && tags.includes("long-context")) {
    return true
  }

  return false
}


export function isDateSnapshotModel(modelId) {
  if (typeof modelId !== "string" || !modelId.trim()) return false
  const id = modelId.trim().toLowerCase()
  if (/-(202\d-[01]\d-[0-3]\d)$/.test(id)) return true
  if (/-(202\d[01]\d[0-3]\d)$/.test(id)) return true
  if (/-(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(id)) return true
  if (/-(00[1-9])$/.test(id)) return true
  if (/-preview-(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(id)) return true
  return false
}

export function extractCanonicalBaseId(modelId) {
  if (typeof modelId !== "string" || !modelId.trim()) return ""
  const trimmed = modelId.trim()
  return trimmed
    .replace(/-preview-(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/i, "")
    .replace(/-(202\d-[01]\d-[0-3]\d)$/i, "")
    .replace(/-(202\d[01]\d[0-3]\d)$/i, "")
    .replace(/-(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/i, "")
    .replace(/-(00[1-9])$/i, "")
}

export function collapseSnapshotModels(models, { collapse = true } = {}) {
  if (!Array.isArray(models)) return []
  if (!collapse) return models

  const idSet = new Set(models.map((m) => m?.id).filter(Boolean))
  return models.filter((model) => {
    if (!model || !model.id) return false
    if (isDateSnapshotModel(model.id)) {
      const baseId = extractCanonicalBaseId(model.id)
      if (baseId && baseId !== model.id && idSet.has(baseId)) {
        return false
      }
    }
    return true
  })
}
