import { statusOfError } from './reliability.js'

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

export function profileOf(settings, provider) {
  try { return settings?.get(PIAI_NS)?.providers?.[provider] ?? {} }
  catch { return {} }
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function diagnosticMessage(error) {
  return errorMessage(error).replace(/(api[_-]?key|token|secret|authorization|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 160)
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
    const section = settings?.get?.(ns)
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
    const rows = settings?.get?.('dsh-key-rotation')?.providers
    if (!Array.isArray(rows)) return []
    return rows.filter((row) => row?.provider === provider).flatMap((row) => Array.isArray(row.keys) ? row.keys : [])
  } catch {
    return []
  }
}
