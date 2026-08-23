const FIELD_ALIASES = Object.freeze({
  contextWindow: ['contextWindow', 'context_window', 'contextLength', 'context_length'],
  maxTokens: ['maxTokens', 'max_tokens', 'max_output_tokens', 'maxOutputTokens'],
})

function firstNumber(row, fields) {
  for (const field of fields) {
    const value = Number(row?.[field])
    if (Number.isFinite(value) && value > 0) return value
  }
  return undefined
}

export function normalizeModel(provider, row) {
  if (typeof row === 'string') {
    row = { id: row }
  }
  if (!row || typeof row !== 'object') return null
  const id = String(row.id ?? row.slug ?? row.model ?? '').trim()
  if (!id) return null
  const name = String(row.name ?? row.displayName ?? row.display_name ?? id).trim() || id
  const contextWindow = firstNumber(row, FIELD_ALIASES.contextWindow)
  const maxTokens = firstNumber(row, FIELD_ALIASES.maxTokens)
  return {
    provider,
    id,
    name,
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(row.description ? { description: String(row.description) } : {}),
  }
}

export function normalizeModels(provider, rows) {
  const out = []
  const seen = new Set()
  for (const row of rows ?? []) {
    const model = normalizeModel(provider, row)
    if (!model || seen.has(model.id)) continue
    seen.add(model.id)
    out.push(model)
  }
  return out
}

export function diffModels(previous, next) {
  const before = new Map(normalizeModels('', previous).map((row) => [row.id, row]))
  const after = new Map(normalizeModels('', next).map((row) => [row.id, row]))
  const added = []
  const removed = []
  const changed = []
  for (const [id, model] of after) {
    if (!before.has(id)) added.push(model)
    else if (JSON.stringify(before.get(id)) !== JSON.stringify(model)) {
      changed.push({ before: before.get(id), after: model })
    }
  }
  for (const [id, model] of before) {
    if (!after.has(id)) removed.push(model)
  }
  return { added, removed, changed, hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0 }
}
