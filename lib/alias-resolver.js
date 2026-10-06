export const VIRTUAL_STRATEGIES = Object.freeze(['fastest', 'cheapest', 'best-code'])

export const VIRTUAL_ALIASES = Object.freeze(new Set(['@fast', '@cheap', '@best-code']))

export function isVirtualAlias(name, strategy) {
  if (strategy && VIRTUAL_STRATEGIES.includes(typeof strategy === 'string' ? strategy.trim() : '')) return true
  if (typeof name !== 'string') return false
  const clean = name.trim().toLowerCase()
  return VIRTUAL_ALIASES.has(clean)
}

export function validateAliasName(name) {
  if (typeof name !== 'string') return false
  const clean = name.trim()
  return /^@?[a-zA-Z0-9_\-.]{1,64}$/.test(clean)
}

function modelScoreForCode(provider, model) {
  let score = 0
  const id = String(model?.id ?? '').toLowerCase()
  const name = String(model?.name ?? '').toLowerCase()

  if (model?.capabilities?.code) score += 100
  if (model?.capabilities?.reasoning) score += 50

  if (id.includes('claude-3-7-sonnet') || id.includes('claude-3-5-sonnet') || id.includes('claude-3.5-sonnet')) score += 200
  else if (id.includes('o3') || id.includes('o1') || id.includes('gpt-4o')) score += 180
  else if (id.includes('deepseek-r1') || id.includes('deepseek-v3') || id.includes('deepseek-coder')) score += 170
  else if (id.includes('qwen-2.5-coder') || id.includes('qwen2.5-coder') || id.includes('qwen-coder')) score += 160
  else if (id.includes('codestral') || id.includes('devin') || id.includes('code')) score += 120

  if (model?.contextWindow && model.contextWindow >= 128000) score += 20
  return score
}

function estimateLatency(provider, model, probes = {}) {
  const key = String(provider) + ':' + String(model.id)
  if (probes[key]?.latencyMs && Number.isFinite(probes[key].latencyMs)) {
    return probes[key].latencyMs
  }
  let base = 800
  const prov = String(provider).toLowerCase()
  if (prov === 'groq' || prov === 'cerebras') base = 120
  else if (prov === 'fireworks') base = 250
  else if (prov === 'together') base = 350
  else if (prov === 'deepseek') base = 400
  else if (prov === 'openai') base = 500

  const id = String(model.id).toLowerCase()
  if (id.includes('flash') || id.includes('instant') || id.includes('turbo') || id.includes('haiku')) base *= 0.6
  if (id.includes('mini') || id.includes('8b') || id.includes('7b')) base *= 0.7
  if (id.includes('reasoning') || id.includes('r1') || id.includes('o1')) base *= 2.5
  return Math.round(base)
}

export function resolveAlias(aliasName, {
  aliases = {},
  modelCatalogs = {},
  healthResults = [],
  isCircuitOpen = () => false,
  modelProbes = {},
} = {}) {
  if (typeof aliasName !== 'string' || !aliasName.trim()) {
    throw Object.assign(new Error('alias name is required'), { code: 'INVALID_ALIAS' })
  }
  const clean = aliasName.trim()
  const custom = aliases[clean]

  // 1. Fallback chain alias
  if (custom?.targets && Array.isArray(custom.targets) && custom.targets.length > 0) {
    const skipped = []
    for (let i = 0; i < custom.targets.length; i++) {
      const target = custom.targets[i]
      const circuitBlocked = isCircuitOpen(target.provider)
      const healthFail = healthResults.find((h) => h.provider === target.provider && h.status === 'error')
      if (circuitBlocked || healthFail) {
        skipped.push({ ...target, reason: circuitBlocked ? 'circuit_open' : 'health_failed' })
        continue
      }
      return {
        alias: clean,
        provider: target.provider,
        model: target.model,
        fallbackUsed: i > 0,
        index: i,
        skipped,
        reason: i > 0 ? 'fallback_selected' : 'primary_healthy',
      }
    }
    // All targets had issues, return first as best-effort with warning
    return {
      alias: clean,
      provider: custom.targets[0].provider,
      model: custom.targets[0].model,
      fallbackUsed: true,
      warning: 'all_targets_unhealthy',
      skipped,
    }
  }

  // 2. Static explicit alias
  if (custom?.provider && custom?.model && !custom.strategy) {
    const circuitBlocked = isCircuitOpen(custom.provider)
    return {
      alias: clean,
      provider: custom.provider,
      model: custom.model,
      fallbackUsed: false,
      ...(circuitBlocked ? { warning: 'circuit_open', circuitOpen: true } : {}),
    }
  }

  // 3. Strategy resolution (@fast, @cheap, @best-code or custom.strategy)
  let strategy = custom?.strategy
  const lower = clean.toLowerCase()
  if (!strategy && isVirtualAlias(clean)) {
    if (lower === '@fast') strategy = 'fastest'
    else if (lower === '@cheap') strategy = 'cheapest'
    else if (lower === '@best-code') strategy = 'best-code'
  }

  if (strategy) {
    if (!VIRTUAL_STRATEGIES.includes(strategy)) {
      throw Object.assign(new Error(`Invalid strategy: ${strategy}`), { code: 'INVALID_STRATEGY' })
    }
    const available = []
    for (const [provider, models] of Object.entries(modelCatalogs)) {
      if (isCircuitOpen(provider)) continue
      if (!Array.isArray(models)) continue
      for (const m of models) {
        if (!m?.id) continue
        available.push({ provider, model: m })
      }
    }

    if (available.length === 0) {
      return { alias: clean, strategy, resolved: null, error: 'NO_HEALTHY_MODELS' }
    }

    if (strategy === 'fastest') {
      const scored = available.map((item) => {
        const probeKey = `${item.provider}:${item.model.id}`
        const probe = modelProbes[probeKey]
        const measured = probe?.latencyMs && Number.isFinite(probe.latencyMs) && probe.ok !== false
        const latencyMs = measured ? Math.round(probe.latencyMs) : estimateLatency(item.provider, item.model, modelProbes)
        return {
          ...item,
          latencyMs,
          measured: Boolean(measured),
        }
      })
      scored.sort((a, b) => {
        if (a.measured && !b.measured) return -1
        if (!a.measured && b.measured) return 1
        return a.latencyMs - b.latencyMs
      })
      const best = scored[0]
      return {
        alias: clean,
        strategy: 'fastest',
        provider: best.provider,
        model: best.model.id,
        name: best.model.name || best.model.id,
        latencyMs: best.latencyMs,
        fallbackUsed: false,
        reason: best.measured ? 'lowest_latency' : 'estimated_lowest_latency',
      }
    }

    if (strategy === 'cheapest') {
      const priced = available.filter((item) => {
        const p = item.model?.pricing
        return p && (Number.isFinite(p.inputPerToken) || Number.isFinite(p.outputPerToken))
      }).map((item) => {
        const p = item.model.pricing
        const cost = (p.inputPerToken || 0) + (p.outputPerToken || 0)
        return { ...item, cost }
      })

      if (priced.length > 0) {
        priced.sort((a, b) => a.cost - b.cost)
        const best = priced[0]
        return {
          alias: clean,
          strategy: 'cheapest',
          provider: best.provider,
          model: best.model.id,
          name: best.model.name || best.model.id,
          pricing: best.model.pricing,
          costPerToken: best.cost,
          fallbackUsed: false,
          reason: 'lowest_price',
        }
      }
      // If no pricing metadata available, pick a mini/flash model as fallback
      const fallback = available.find((a) => /(mini|flash|small|lite)/i.test(a.model.id)) || available[0]
      return {
        alias: clean,
        strategy: 'cheapest',
        provider: fallback.provider,
        model: fallback.model.id,
        name: fallback.model.name || fallback.model.id,
        fallbackUsed: true,
        reason: 'heuristic_cheapest_fallback',
      }
    }

    if (strategy === 'best-code') {
      const scored = available.map((item) => ({
        ...item,
        score: modelScoreForCode(item.provider, item.model),
      }))
      scored.sort((a, b) => b.score - a.score)
      const best = scored[0]
      return {
        alias: clean,
        strategy: 'best-code',
        provider: best.provider,
        model: best.model.id,
        name: best.model.name || best.model.id,
        capabilities: best.model.capabilities,
        score: best.score,
        fallbackUsed: false,
        reason: 'top_coding_capability',
      }
    }
  }

  throw Object.assign(new Error("Unknown alias: " + clean), { code: 'UNKNOWN_ALIAS' })
}
