const PRINTABLE_API_KEY = /^[\x21-\x7E]+$/

export function normalizeApiKey(value) {
  if (value === undefined || value === null) return ''
  const key = String(value).trim()
  if (!key) return ''
  if (!PRINTABLE_API_KEY.test(key)) {
    throw new Error('API key contains characters that cannot be sent in an HTTP header')
  }
  return key
}

export function createCredentialResolver(ctx) {
  const credentials = ctx?.get?.('credentials') ?? ctx?.credentials
  return async (ref) => {
    if (!ref) return ''
    if (!credentials?.resolve) throw new Error('DSH credentials service is unavailable')
    const result = await credentials.resolve(ref)
    return normalizeApiKey(typeof result === 'string' ? result : result?.value)
  }
}
