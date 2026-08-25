const PRINTABLE_API_KEY = /^[\x21-\x7E]+$/
const SAFE_SOURCE = /^(env|file|project-env|user-env|unknown)$/
const SAFE_REF = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_DIAGNOSTIC_REFS = 32

export function normalizeApiKey(value) {
  if (value === undefined || value === null) return ''
  const key = String(value).trim()
  if (!key) return ''
  if (!PRINTABLE_API_KEY.test(key)) {
    throw new Error('API key contains characters that cannot be sent in an HTTP header')
  }
  return key
}

export function normalizeCredentialRef(value) {
  if (typeof value !== 'string') return ''
  const ref = value.trim()
  return SAFE_REF.test(ref) ? ref : ''
}

export function maskCredentialRef(ref) {
  const value = normalizeCredentialRef(ref)
  if (!value) return 'invalid reference'
  if (value.length <= 6) return `••••${value.slice(-2)}`
  return `${value.slice(0, 2)}…${value.slice(-4)}`
}

function safeSource(value) {
  const source = typeof value === 'string' ? value : 'unknown'
  return SAFE_SOURCE.test(source) ? source : 'unknown'
}

function safeCode(error) {
  const code = error?.code ?? error?.status ?? error?.statusCode
  if (typeof code === 'number' && Number.isFinite(code)) return String(Math.trunc(code)).slice(0, 8)
  if (typeof code === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(code)) return code
  return 'credential-error'
}

function safeMessage(error) {
  const source = error instanceof Error ? error.message : String(error ?? '')
  return source.replace(/(api[_-]?key|token|secret|authorization|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 160)
}

export function createCredentialResolver(ctx) {
  const credentials = ctx?.get?.('credentials') ?? ctx?.credentials
  const observations = new Map()
  const remember = (ref, patch) => {
    const normalized = normalizeCredentialRef(ref)
    if (!normalized) return
    observations.set(normalized, { ...(observations.get(normalized) ?? {}), ...patch, at: Date.now() })
  }
  const resolver = async (ref) => {
    const normalized = normalizeCredentialRef(ref)
    if (!normalized) return ''
    if (!credentials?.resolve) {
      remember(normalized, { status: 'unavailable', code: 'CREDENTIALS_UNAVAILABLE' })
      throw new Error('DSH credentials service is unavailable')
    }
    try {
      const result = await credentials.resolve(normalized)
      const value = normalizeApiKey(typeof result === 'string' ? result : result?.value)
      remember(normalized, { status: value ? 'resolved' : 'missing', source: safeSource(result?.source) })
      return value
    } catch (error) {
      const safe = Object.assign(new Error(safeMessage(error)), {
        ...(error?.code === undefined ? {} : { code: error.code }),
        ...(error?.status === undefined ? {} : { status: error.status }),
        ...(error?.statusCode === undefined ? {} : { statusCode: error.statusCode }),
      })
      remember(normalized, { status: 'error', code: safeCode(error), message: safe.message })
      throw safe
    }
  }
  resolver.describe = async (ref) => {
    const normalized = normalizeCredentialRef(ref)
    if (!normalized) return { ref: '', label: maskCredentialRef(''), configured: false, status: 'invalid' }
    const observed = observations.get(normalized)
    if (!credentials?.describe) {
      return { ref: normalized, label: maskCredentialRef(normalized), configured: 'unknown', status: 'describe-unavailable', ...(observed ? { lastResolution: structuredClone(observed) } : {}) }
    }
    try {
      const info = await credentials.describe(normalized)
      return {
        ref: normalized,
        label: maskCredentialRef(normalized),
        configured: info?.configured === true,
        source: safeSource(info?.source),
        writable: info?.writable !== false,
        ...(observed ? { lastResolution: structuredClone(observed) } : {}),
      }
    } catch (error) {
      return { ref: normalized, label: maskCredentialRef(normalized), configured: 'unknown', status: 'describe-error', code: safeCode(error), message: safeMessage(error), ...(observed ? { lastResolution: structuredClone(observed) } : {}) }
    }
  }
  resolver.diagnostics = async (refs) => {
    const unique = [...new Set((Array.isArray(refs) ? refs : []).map(normalizeCredentialRef).filter(Boolean))].slice(0, MAX_DIAGNOSTIC_REFS)
    return Promise.all(unique.map((ref, index) => resolver.describe(ref).then((row) => ({ order: index + 1, ...row }))))
  }
  return resolver
}
