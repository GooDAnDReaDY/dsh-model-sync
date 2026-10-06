import { resolveAlias as resolveSmartAlias, validateAliasName, VIRTUAL_STRATEGIES, isVirtualAlias } from './alias-resolver.js'

export function createConfigTransfer({
  getConfig = () => ({}),
  saveConfig = async () => {},
  listProviders = () => [],
  validatePolicy,
  isCircuitOpen = () => false,
  getHealthResults = () => [],
  getModelProbes = () => ({}),
} = {}) {
  function exportConfig() {
    const config = getConfig() ?? {}
    const pmap = {}
    for (const p of listProviders()) {
      if (p.configured) {
        pmap[p.provider] = {
          policy: config.modelPolicies?.[p.provider] ?? {},
          selectedModels: config.modelSelections?.[p.provider] ?? []
        }
      }
    }
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      plugin: '@goodandready/dsh-model-sync',
      providers: pmap,
      aliases: config.aliases ?? {},
      scheduler: {
        scheduleEnabled: config.scheduleEnabled ?? false,
        intervalMinutes: config.intervalMinutes ?? 60,
        autoApply: config.autoApply ?? false
      }
    }
  }

  async function importConfig(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw Object.assign(new Error('invalid config payload'), { code: 'INVALID_CONFIG' })
    }
    if (typeof saveConfig !== 'function') throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
    const config = getConfig() ?? {}
    const importedProviders = []
    const importedAliases = []
    const patch = {}

    if (data.providers && typeof data.providers === 'object') {
      const currentPolicies = structuredClone(config.modelPolicies ?? {})
      const currentSelections = structuredClone(config.modelSelections ?? {})
      for (const [pname, pdata] of Object.entries(data.providers)) {
        if (pdata && typeof pdata === 'object') {
          if (pdata.policy) {
            currentPolicies[pname] = typeof validatePolicy === 'function' ? validatePolicy(pdata.policy) : pdata.policy
            importedProviders.push(pname)
          }
          if (Array.isArray(pdata.selectedModels)) {
            currentSelections[pname] = [...new Set(pdata.selectedModels.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim()))].slice(0, 1000)
            importedProviders.push(pname)
          }
        }
      }
      patch.modelPolicies = currentPolicies
      patch.modelSelections = currentSelections
    }

    if (data.aliases && typeof data.aliases === 'object') {
      const currentAliases = structuredClone(config.aliases ?? {})
      for (const [k, v] of Object.entries(data.aliases)) {
        if (validateAliasName(k) && v && typeof v === 'object') {
          const entry = { updatedAt: Date.now() }
          if (Array.isArray(v.targets)) {
            entry.targets = v.targets
          } else if (v.strategy && typeof v.strategy === 'string') {
            const strat = v.strategy.trim()
            if (VIRTUAL_STRATEGIES.includes(strat)) {
              entry.strategy = strat
              entry.isVirtual = isVirtualAlias(k, strat)
            } else {
              continue
            }
          } else if (v.provider && v.model) {
            entry.provider = v.provider
            entry.model = v.model
          }
          currentAliases[k.trim()] = entry
          importedAliases.push(k.trim())
        }
      }
      patch.aliases = currentAliases
    }

    if (data.scheduler && typeof data.scheduler === 'object') {
      if (typeof data.scheduler.scheduleEnabled === 'boolean') patch.scheduleEnabled = data.scheduler.scheduleEnabled
      if (typeof data.scheduler.intervalMinutes === 'number') patch.intervalMinutes = data.scheduler.intervalMinutes
      if (typeof data.scheduler.autoApply === 'boolean') patch.autoApply = data.scheduler.autoApply
    }

    await saveConfig(patch)
    return {
      success: true,
      importedProviders: [...new Set(importedProviders)],
      importedAliases: [...new Set(importedAliases)]
    }
  }

  function getAliases() {
    const config = getConfig() ?? {}
    return config.aliases ?? {}
  }

  async function setAlias({ alias, provider, model, targets, strategy } = {}) {
    if (!validateAliasName(alias)) {
      throw Object.assign(new Error('alias must be 1-64 alphanumeric characters, @ or _-.'), { code: 'INVALID_ALIAS' })
    }
    const trimmedAlias = alias.trim()
    const config = getConfig() ?? {}
    const currentAliases = structuredClone(config.aliases ?? {})

    if (Array.isArray(targets) && targets.length > 0) {
      currentAliases[trimmedAlias] = { targets, updatedAt: Date.now() }
    } else if (strategy !== undefined && strategy !== null && strategy !== '') {
      const cleanStrategy = typeof strategy === 'string' ? strategy.trim() : ''
      if (!VIRTUAL_STRATEGIES.includes(cleanStrategy)) {
        throw Object.assign(new Error(`Invalid strategy: ${strategy}. Supported: ${VIRTUAL_STRATEGIES.join(', ')}`), { code: 'INVALID_STRATEGY' })
      }
      currentAliases[trimmedAlias] = {
        strategy: cleanStrategy,
        isVirtual: isVirtualAlias(trimmedAlias, cleanStrategy),
        updatedAt: Date.now(),
      }
    } else {
      if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
      if (typeof model !== 'string' || !model) throw new Error('model is required')
      currentAliases[trimmedAlias] = { provider, model, updatedAt: Date.now() }
    }

    if (typeof saveConfig !== 'function') throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
    await saveConfig({ aliases: currentAliases })
    return { alias: trimmedAlias, ...currentAliases[trimmedAlias], aliases: currentAliases }
  }

  async function deleteAlias({ alias } = {}) {
    if (typeof alias !== 'string' || !alias) throw new Error('alias is required')
    if (typeof saveConfig !== 'function') throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
    const config = getConfig() ?? {}
    const currentAliases = structuredClone(config.aliases ?? {})
    delete currentAliases[alias.trim()]
    await saveConfig({ aliases: currentAliases })
    return { alias: alias.trim(), deleted: true, aliases: currentAliases }
  }

  function resolveAlias(aliasName) {
    const config = getConfig() ?? {}
    return resolveSmartAlias(aliasName, {
      aliases: config.aliases ?? {},
      modelCatalogs: config.modelCatalogs ?? {},
      isCircuitOpen,
      healthResults: typeof getHealthResults === 'function' ? getHealthResults() : [],
      modelProbes: typeof getModelProbes === 'function' ? getModelProbes() : {},
    })
  }

  return {
    exportConfig,
    importConfig,
    getAliases,
    setAlias,
    deleteAlias,
    resolveAlias,
  }
}
