export function createConfigTransfer({ getConfig = () => ({}), saveConfig = async () => {}, listProviders = () => [], validatePolicy } = {}) {
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
            currentSelections[pname] = pdata.selectedModels.filter((m) => typeof m === 'string')
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
        if (typeof k === 'string' && /^[a-zA-Z0-9_\-.]{1,64}$/.test(k.trim()) && v && typeof v === 'object' && typeof v.provider === 'string' && typeof v.model === 'string') {
          currentAliases[k.trim()] = { provider: v.provider, model: v.model, updatedAt: Date.now() }
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

  async function setAlias({ alias, provider, model } = {}) {
    if (typeof alias !== 'string' || !/^[a-zA-Z0-9_\-.]{1,64}$/.test(alias.trim())) {
      throw Object.assign(new Error('alias must be 1-64 alphanumeric characters or _-.'), { code: 'INVALID_ALIAS' })
    }
    const trimmedAlias = alias.trim()
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (typeof model !== 'string' || !model) throw new Error('model is required')
    if (typeof saveConfig !== 'function') throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })
    const config = getConfig() ?? {}
    const currentAliases = structuredClone(config.aliases ?? {})
    currentAliases[trimmedAlias] = { provider, model, updatedAt: Date.now() }
    await saveConfig({ aliases: currentAliases })
    return { alias: trimmedAlias, provider, model, aliases: currentAliases }
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

  return {
    exportConfig,
    importConfig,
    getAliases,
    setAlias,
    deleteAlias,
  }
}
