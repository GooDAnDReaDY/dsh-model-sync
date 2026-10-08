import { sanitizeSecretString } from './credentials.js'
import { statusOfError } from './reliability.js'
import { historyEntry } from './history.js'
import { normalizeModels } from './models.js'
import { catalogPatch } from './reconcile.js'

export const PIAI_NS = 'llm-pi-ai'
export const DEFAULT_RELIABILITY = Object.freeze({
  timeoutMs: 15000,
  retryAttempts: 3,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 4000,
  concurrency: 4,
  circuitBreakerFailures: 3,
  circuitBreakerCooldownMs: 300000,
})

export function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.floor(number)))
}

export function reliabilityOptions(config, options) {
  const source = { ...config, ...options }
  const baseDelay = boundedInteger(source.retryBaseDelayMs, DEFAULT_RELIABILITY.retryBaseDelayMs, 0, 60000)
  const cooldownMs = source.circuitBreakerCooldownMs !== undefined
    ? boundedInteger(source.circuitBreakerCooldownMs, DEFAULT_RELIABILITY.circuitBreakerCooldownMs, 0, 3600000)
    : boundedInteger(Number(source.circuitBreakerCooldownMinutes) * 60000, DEFAULT_RELIABILITY.circuitBreakerCooldownMs, 0, 3600000)
  return {
    timeoutMs: boundedInteger(source.requestTimeoutMs, DEFAULT_RELIABILITY.timeoutMs, 100, 120000),
    retryAttempts: boundedInteger(source.retryAttempts, DEFAULT_RELIABILITY.retryAttempts, 1, 6),
    retryBaseDelayMs: baseDelay,
    retryMaxDelayMs: Math.max(baseDelay, boundedInteger(source.retryMaxDelayMs, DEFAULT_RELIABILITY.retryMaxDelayMs, 0, 120000)),
    concurrency: boundedInteger(source.concurrency, DEFAULT_RELIABILITY.concurrency, 1, 32),
    circuitBreakerFailures: boundedInteger(source.circuitBreakerFailures, DEFAULT_RELIABILITY.circuitBreakerFailures, 0, 20),
    circuitBreakerCooldownMs: cooldownMs,
  }
}

export function settingsOf(ctx) {
  try { return (typeof ctx.get === 'function' ? (ctx.get('settings') ?? ctx.settings) : ctx.settings) } catch { return ctx.settings }
}

export function llmOf(ctx) {
  try {
    const llm = typeof ctx.get === 'function' ? ctx.get('llm') : null
    return (llm && typeof llm === 'object' && (llm.listConfigurableProviders || llm.listProviders)) ? llm : ctx.llm
  } catch {
    return ctx.llm
  }
}

export function descriptorOf(settings, ns) {
  try { return settings?.describe?.({ redactSecrets: true })?.find((row) => row.ns === ns) }
  catch { return undefined }
}

export function sectionOf(settings, ns) {
  try {
    const desc = descriptorOf(settings, ns)
    if (desc && desc.value !== undefined) return desc.value
    if (typeof settings?.get === 'function') return settings.get(ns)
    return undefined
  } catch {
    return undefined
  }
}

export function profileOf(settings, provider) {
  try {
    const piai = sectionOf(settings, PIAI_NS)?.providers?.[provider]
    if (piai) return piai
    if (provider === 'commandcode') {
      const cc = sectionOf(settings, 'llm-commandcode')
      return {
        apiKeyEnv: cc?.apiKeyEnv ?? 'COMMANDCODE_API_KEY',
        credentialRef: cc?.apiKeyEnv ?? 'COMMANDCODE_API_KEY',
        baseURL: cc?.apiBase ?? 'https://api.commandcode.ai',
        models: cc?.visibleModels ?? [],
      }
    }
    return {}
  }
  catch { return {} }
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function diagnosticMessage(error) {
  return sanitizeSecretString(errorMessage(error)).slice(0, 160)
}

export function adapterErrorType(error) {
  if (error?.adapterCode === 'auth') return 'auth'
  if (error?.adapterCode === 'rate-limit') return 'rate-limit'
  if (error?.adapterCode === 'schema') return 'schema'
  if (error?.adapterCode === 'endpoint') return 'endpoint'
  if (error?.code === 'CREDENTIALS_UNAVAILABLE' || error?.code === 'AUTH') return 'credential'
  const status = statusOfError(error)
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate-limit'
  if (status) return 'http'
  return 'endpoint'
}

export async function replaceWithRetry(settings, ns, patchFn, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    const section = sectionOf(settings, ns)
    const descriptor = descriptorOf(settings, ns)
    if (!section || !descriptor || typeof settings.replace !== 'function') {
      throw Object.assign(new Error(`${ns} settings are not writable`), { code: 'SETTINGS_UNAVAILABLE' })
    }
    const next = patchFn(structuredClone(section))
    try {
      await settings.replace(ns, next, descriptor.revision)
      return next
    } catch (err) {
      lastError = err
      const isConflict = err?.code === 'SETTINGS_CONFLICT' || err?.status === 409 || /conflict|revision/i.test(err?.message || '')
      if (isConflict && i < attempts - 1) {
        continue
      }
      throw err
    }
  }
  throw lastError
}

export function rotationRefs(settings, provider) {
  try {
    const rows = sectionOf(settings, 'dsh-key-rotation')?.providers
    if (!Array.isArray(rows)) return []
    return rows.filter((row) => row?.provider === provider).flatMap((row) => Array.isArray(row.keys) ? row.keys : [])
  } catch {
    return []
  }
}

export function refsFor(row, settings) {
  const profile = profileOf(settings, row.provider)
  const refs = [
    row.apiKeyEnv,
    profile.credentialRef,
    ...(Array.isArray(profile.credentialRefs) ? profile.credentialRefs : []),
    ...(Array.isArray(profile.apiKeyRefs) ? profile.apiKeyRefs : []),
    ...rotationRefs(settings, row.provider),
  ]
  return [...new Set(refs.filter((ref) => typeof ref === 'string' && ref.trim()).map((ref) => ref.trim()))].slice(0, 32)
}

export async function performHistoryRollback({ ctx, config, providers = [], historyId, provider } = {}) {
  if (typeof historyId !== 'string' || !historyId) throw Object.assign(new Error('historyId is required'), { code: 'INVALID_HISTORY' })
  if (typeof provider !== 'string' || !provider) throw Object.assign(new Error('provider is required'), { code: 'INVALID_HISTORY' })
  const entry = historyEntry(config.history, historyId)
  if (!entry) throw Object.assign(new Error(`history entry not found: ${historyId}`), { code: 'HISTORY_NOT_FOUND' })
  const snapshot = (entry.providers ?? []).find((row) => row.provider === provider)
  if (!snapshot || !Array.isArray(snapshot.before)) throw Object.assign(new Error(`history snapshot not found: ${provider}`), { code: 'HISTORY_NOT_FOUND' })
  if (!providers.some((row) => row.provider === provider && row.configured)) throw Object.assign(new Error(`provider is not configured: ${provider}`), { code: 'PROVIDER_NOT_CONFIGURED' })
  const settings = settingsOf(ctx)
  const section = sectionOf(settings, PIAI_NS)
  const descriptor = descriptorOf(settings, PIAI_NS)
  if (!section || !descriptor || typeof settings.replace !== 'function') {
    throw Object.assign(new Error('llm-pi-ai settings are not writable'), { code: 'SETTINGS_UNAVAILABLE' })
  }
  const current = normalizeModels(provider, profileOf(settings, provider).models ?? [])
  const target = normalizeModels(provider, snapshot.before)
  if (JSON.stringify(current) === JSON.stringify(target)) {
    return { historyId, provider, models: target, applied: false, allowlistUntouched: true }
  }
  await replaceWithRetry(settings, PIAI_NS, (sec) => catalogPatch(sec, provider, target))
  return { historyId, provider, models: target, applied: true, allowlistUntouched: true }
}
