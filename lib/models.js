/**
 * DeepSeek Harness Model Sync — Model Normalization Facade & Diffing (#277)
 */

import { lookupReferenceLimits, lookupReferenceSpec } from './specs-database.js'
import { lookupReferencePricing } from './pricing-database.js'
import {
  FIELD_ALIASES,
  firstNumber,
  normalizeCapabilities,
  normalizeCompat,
  normalizeInput,
  normalizeTags,
  normalizeAliases,
  normalizeLifecycle,
  normalizePricing,
  normalizeDate,
  normalizeReasoningConfig,
  classifyModelType,
} from './parsers/normalizers.js'
import {
  deriveModelTags,
  isCuratedModel,
  isDateSnapshotModel,
  extractCanonicalBaseId,
  collapseSnapshotModels,
} from './parsers/curation.js'
import { CLINEPASS_MODELS, parseClinePassModels } from './parsers/clinepass.js'

export {
  deriveModelTags,
  isCuratedModel,
  isDateSnapshotModel,
  extractCanonicalBaseId,
  collapseSnapshotModels,
  CLINEPASS_MODELS,
  parseClinePassModels,
}
export * from './parsers/normalizers.js'

export function normalizeModel(provider, row) {
  if (typeof row === 'string') {
    row = { id: row }
  }
  if (!row || typeof row !== 'object') return null
  const effectiveProvider = (typeof provider === 'string' && provider.trim())
    ? provider.trim()
    : (typeof row.provider === 'string' ? row.provider.trim() : '')
  const id = String(row.id ?? row.slug ?? row.model ?? (typeof row.name === 'string' && row.name.startsWith('models/') ? row.name.replace(/^models\//, '') : '')).trim()
  if (!id) return null
  const name = String(row.name ?? row.displayName ?? row.display_name ?? id).trim() || id
  const rawContextWindow = firstNumber(row, FIELD_ALIASES.contextWindow)
  const rawMaxOutputTokens = firstNumber(row, FIELD_ALIASES.maxOutputTokens)
  const refLimits = lookupReferenceLimits(effectiveProvider || provider, id)
  const contextWindow = rawContextWindow ?? refLimits?.contextWindow
  const maxOutputTokens = rawMaxOutputTokens ?? refLimits?.maxOutputTokens
  const maxTokens = maxOutputTokens ?? firstNumber(row, FIELD_ALIASES.maxTokens)
  const capabilities = normalizeCapabilities(row)
  const pricing = normalizePricing(row) ?? lookupReferencePricing(effectiveProvider || provider, id)
  const tags = normalizeTags(row)
  const aliases = normalizeAliases(row, id)
  const lifecycle = normalizeLifecycle(row)
  const input = normalizeInput(row)
  const compat = normalizeCompat(effectiveProvider, row, id)
  const reasoningConfig = normalizeReasoningConfig(effectiveProvider || provider, row, id, capabilities)
  const firstSeenAt = normalizeDate(row.firstSeenAt)
  const createdAt = normalizeDate(row.createdAt ?? row.created)
  const modelType = classifyModelType(id, row)
  return {
    provider: effectiveProvider || provider,
    id,
    name,
    ...(row?.modelType || (modelType && modelType !== 'chat') ? { modelType: row?.modelType || modelType } : {}),
    ...(firstSeenAt === undefined ? {} : { firstSeenAt }),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(row.description ? { description: String(row.description) } : {}),
    ...(input === undefined ? {} : { input }),
    ...(compat === undefined ? {} : { compat }),
    ...(capabilities === undefined ? {} : { capabilities }),
    ...(reasoningConfig === undefined ? {} : { reasoningConfig }),
    ...(pricing === undefined ? {} : { pricing }),
    ...(tags === undefined ? {} : { tags }),
    ...(aliases.length === 0 ? {} : { aliases }),
    ...(lifecycle === undefined ? {} : { lifecycle }),
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

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function diffModels(previous, next) {
  const sortModels = (rows) => normalizeModels('', rows).sort((left, right) => left.id.localeCompare(right.id))
  const beforeRows = sortModels(previous)
  const afterRows = sortModels(next)
  const before = new Map(beforeRows.map((row) => [row.id, row]))
  const after = new Map(afterRows.map((row) => [row.id, row]))
  const added = []
  const removed = []
  const renamed = []
  const changed = []
  const renamedBefore = new Set()
  for (const [id, model] of after) {
    if (!before.has(id)) continue
    if (stableStringify(before.get(id)) !== stableStringify(model)) {
      changed.push({ before: before.get(id), after: model })
    }
  }
  for (const [id, model] of after) {
    if (before.has(id)) continue
    const match = beforeRows.find((candidate) => {
      if (renamedBefore.has(candidate.id)) return false
      return model.aliases?.includes(candidate.id) || candidate.aliases?.includes(model.id)
    })
    if (match) {
      renamed.push({ before: match, after: model })
      renamedBefore.add(match.id)
    } else {
      added.push(model)
    }
  }
  for (const [id, model] of before) {
    if (!after.has(id) && !renamedBefore.has(id)) removed.push(model)
  }
  added.sort((left, right) => left.id.localeCompare(right.id))
  removed.sort((left, right) => left.id.localeCompare(right.id))
  renamed.sort((left, right) => left.before.id.localeCompare(right.before.id))
  changed.sort((left, right) => left.before.id.localeCompare(right.before.id))
  return {
    added,
    removed,
    renamed,
    changed,
    hasChanges: added.length > 0 || removed.length > 0 || renamed.length > 0 || changed.length > 0,
  }
}

