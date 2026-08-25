import { diffModels, normalizeModels } from './models.js'

function sameModel(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function reconcileModels(provider, current, discovered, {
  removeMissing = false,
  removeIds = [],
} = {}) {
  const before = normalizeModels(provider, current)
  const advertised = normalizeModels(provider, discovered)
  const advertisedById = new Map(advertised.map((row) => [row.id, row]))
  const explicitRemoveIds = new Set(removeIds)
  const discoveryDiff = diffModels(before, advertised)
  const renamedBefore = new Set(discoveryDiff.renamed.map((row) => row.before.id))
  const next = []
  const stale = []
  for (const row of before) {
    const fresh = advertisedById.get(row.id)
    if (fresh) next.push(fresh)
    else if (renamedBefore.has(row.id)) {
      // An explicit provider alias is safe evidence that the old id was renamed.
    } else {
      stale.push(row)
      if (!removeMissing && !explicitRemoveIds.has(row.id)) next.push(row)
    }
  }
  const known = new Set(before.map((row) => row.id))
  for (const row of advertised) {
    if (!known.has(row.id)) next.push(row)
  }
  const diff = diffModels(before, next)
  return {
    provider,
    before,
    advertised,
    next,
    stale,
    diff,
    changed: diff.hasChanges,
    unchangedAdvertised: advertised.length === before.length && advertised.every((row, index) => sameModel(row, before[index])),
  }
}

export function catalogPatch(section, provider, nextModels) {
  const current = section && typeof section === 'object' ? section : {}
  const providers = current.providers && typeof current.providers === 'object'
    ? structuredClone(current.providers)
    : {}
  const profile = providers[provider] && typeof providers[provider] === 'object'
    ? providers[provider]
    : {}
  providers[provider] = { ...profile, models: structuredClone(nextModels) }
  return { ...structuredClone(current), providers }
}
