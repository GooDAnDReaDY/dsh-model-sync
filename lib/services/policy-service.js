/**
 * DeepSeek Harness Model Sync — Policy, Selection & Webhook Domain Service (#280)
 */

import { sendWebhookNotification } from '../diff-notifier.js'
import { catalogPatch } from '../reconcile.js'
import { normalizeModels, collapseSnapshotModels, stripDisplayNameBadges, formatDisplayNameWithBadges } from '../models.js'
import { filterModels, normalizePolicy, validatePolicy } from '../policy.js'
import { selectableModels } from '../lifecycle.js'
import {
  PIAI_NS,
  settingsOf,
  descriptorOf,
  sectionOf,
  profileOf,
  replaceWithRetry,
} from '../synchronizer-helpers.js'

export function createPolicyService({
  ctx,
  getConfig = () => ({}),
  saveConfig = async () => {},
  providers = () => [],
  getLastRun = () => null,
} = {}) {
  function policyFor(config, provider) {
    return normalizePolicy(config?.modelPolicies?.[provider])
  }

  function listPolicies() {
    const config = getConfig() ?? {}
    return Object.fromEntries(
      providers()
        .filter((row) => row.configured)
        .map((row) => [row.provider, policyFor(config, row.provider)]),
    )
  }

  async function setModelPolicy(provider, policy) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    const row = providers().find((item) => item.provider === provider && item.configured)
    if (!row) throw Object.assign(new Error(`provider is not configured: ${provider}`), { code: 'PROVIDER_NOT_CONFIGURED' })
    const normalized = validatePolicy(policy)
    const config = getConfig() ?? {}
    const previous = structuredClone(config.modelPolicies ?? {})
    const modelPolicies = { ...previous, [provider]: normalized }
    await saveConfig({ modelPolicies })
    return { provider, policy: normalized, applied: false }
  }

  async function setModelSelection(provider, models) {
    if (typeof provider !== 'string' || !provider) throw new Error('provider is required')
    if (!Array.isArray(models)) throw new Error('models must be an array')
    const selectedModels = [...new Set(models.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
    const config = getConfig() ?? {}
    const row = providers().find((item) => item.provider === provider)
    if (!row) throw Object.assign(new Error(`provider is not configured: ${provider}`), { code: 'PROVIDER_NOT_CONFIGURED' })
    const lastRun = getLastRun()
    const latest = lastRun?.results?.find((item) => item.provider === provider && item.status === 'ok')
    const cached = normalizeModels(provider, config.modelCatalogs?.[provider])
    const latestCatalog = latest?.availableModels ?? latest?.models
    const source = latestCatalog !== undefined
      ? latestCatalog
      : cached.length > 0 ? cached : row.availableModels ?? row.models
    const filterOpts = { excludeUtilityModels: config.excludeUtilityModels !== false }
    const available = filterModels(normalizeModels(provider, source), policyFor(config, provider), filterOpts)
    let safeAvailable = selectableModels(config.modelLifecycle, provider, available)
    if (config.collapseDateSnapshots !== false) {
      safeAvailable = collapseSnapshotModels(safeAvailable)
    }
    const availableById = new Map(available.map((model) => [model.id, model]))
    const unknown = selectedModels.filter((id) => !availableById.has(id))
    if (unknown.length > 0) throw Object.assign(new Error(`unknown models for ${provider}: ${unknown.join(', ')}`), { code: 'UNKNOWN_MODEL' })
    if (typeof saveConfig !== 'function') throw Object.assign(new Error('dsh-model-sync settings are not writable'), { code: 'CONFIG_UNAVAILABLE' })

    const settings = settingsOf(ctx)
    const section = sectionOf(settings, PIAI_NS)
    const descriptor = descriptorOf(settings, PIAI_NS)
    const current = normalizeModels(provider, profileOf(settings, provider).models ?? row.models)
    const badgesConfig = config.displayNameBadges
    const applyBadges = Boolean(badgesConfig?.enabled)
    const formatModelName = (model) => {
      if (!model) return model
      const name = applyBadges
        ? formatDisplayNameWithBadges(model, badgesConfig)
        : stripDisplayNameBadges(model.name || model.id)
      return { ...model, name }
    }
    const rawNext = selectedModels.length
      ? selectedModels.map((id) => availableById.get(id))
      : (safeAvailable.length > 0 ? safeAvailable : current)
    const nextModels = rawNext.map(formatModelName)
    const previousModelSelections = structuredClone(config.modelSelections ?? {})
    const modelSelections = { ...previousModelSelections, [provider]: selectedModels }

    await saveConfig({ modelSelections })
    try {
      if (provider === 'commandcode') {
        if (typeof settings?.mutate === 'function') {
          await settings.mutate('llm-commandcode', [
            { op: 'set', path: ['visibleModels'], value: selectedModels.length ? selectedModels : nextModels.map((m) => m.id) },
          ])
        }
        if (section?.providers?.commandcode && typeof settings?.replace === 'function') {
          await replaceWithRetry(settings, PIAI_NS, (sec) => catalogPatch(sec, provider, nextModels))
        }
      } else {
        if (!section || !descriptor || typeof settings.replace !== 'function') {
          throw Object.assign(new Error('llm-pi-ai settings are not writable'), { code: 'SETTINGS_UNAVAILABLE' })
        }
        await replaceWithRetry(settings, PIAI_NS, (sec) => catalogPatch(sec, provider, nextModels))
      }
    } catch (error) {
      try {
        await saveConfig({ modelSelections: previousModelSelections })
      } catch {
        // Preserve the original, more actionable catalog-write error.
      }
      throw error
    }
    return { provider, selectedModels, models: nextModels, availableModels: available, selectableModels: safeAvailable, applied: true }
  }

  async function testWebhook({ url, secret, secretRef }) {
    let resolvedSecret = secret || ''
    const targetRef = (secretRef || (typeof secret === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(secret) ? secret : '')).trim()
    if (targetRef) {
      try {
        const res = await (ctx?.credentials?.resolve ? ctx.credentials.resolve(targetRef) : ctx?.get?.('credentials')?.resolve?.(targetRef))
        if (res) resolvedSecret = typeof res === 'string' ? res : res?.value || ''
      } catch (err) {
        ctx?.logger?.warn?.('[dsh-model-sync] secret ref resolution failed in testWebhook:', err)
      }
      if (!resolvedSecret && secretRef) {
        return { ok: false, error: `Failed to resolve webhook secret credential reference '${secretRef}'` }
      }
    }
    return sendWebhookNotification(url, resolvedSecret, { event: 'model-sync.test', timestamp: Date.now(), test: true })
  }

  return Object.freeze({
    policyFor,
    listPolicies,
    setModelPolicy,
    setModelSelection,
    testWebhook,
  })
}
