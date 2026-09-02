import { normalizeModels } from './models.js'

export const API_KEY_PROVIDER_IDS = Object.freeze([
  'anthropic',
  'ant-ling',
  'azure-openai-responses',
  'cerebras',
  'cloudflare-ai-gateway',
  'cloudflare-workers-ai',
  'deepseek',
  'fireworks',
  'google',
  'groq',
  'huggingface',
  'kimi-coding',
  'minimax',
  'minimax-cn',
  'mistral',
  'moonshotai',
  'moonshotai-cn',
  'nvidia',
  'openai',
  'opencode',
  'opencode-go',
  'openrouter',
  'qwen-token-plan',
  'qwen-token-plan-cn',
  'radius',
  'together',
  'vercel-ai-gateway',
  'xai',
  'xiaomi',
  'xiaomi-token-plan-ams',
  'xiaomi-token-plan-cn',
  'xiaomi-token-plan-sgp',
  'zai',
  'zai-coding-cn',
])

const API_KEY_PROVIDER_SET = new Set(API_KEY_PROVIDER_IDS)

function settingsProfiles(settings) {
  try {
    return settings?.get('llm-pi-ai')?.providers ?? {}
  } catch {
    return {}
  }
}

function liveProviders(llm) {
  return new Map((llm?.listProviders?.() ?? []).map((row) => [row.id, row]))
}

export function isApiKeyProvider(entry, profile) {
  if (profile?.apiKeyEnv || profile?.credentialRef || profile?.apiKeyRef) return true
  return entry?.declared === false && API_KEY_PROVIDER_SET.has(entry.provider)
}

export function listApiKeyProviders(llm, settings) {
  const profiles = settingsProfiles(settings)
  const live = liveProviders(llm)
  const directory = llm?.listConfigurableProviders?.() ?? []
  const out = []
  const seen = new Set()
  for (const entry of directory) {
    const profile = profiles[entry.provider] ?? {}
    if (!isApiKeyProvider(entry, profile) || seen.has(entry.provider)) continue
    seen.add(entry.provider)
    out.push({
      provider: entry.provider,
      displayName: entry.displayName ?? entry.provider,
      settingsNs: entry.settingsNs,
      settingsPath: [...(entry.settingsPath ?? [])],
      declared: entry.declared === true,
      configured: Object.prototype.hasOwnProperty.call(profiles, entry.provider),
      live: live.has(entry.provider),
      apiKeyEnv: profile.apiKeyEnv ?? profile.credentialRef ?? profile.apiKeyRef ?? '',
      credentialRef: profile.credentialRef ?? profile.apiKeyRef ?? profile.apiKeyEnv ?? '',
      baseURL: profile.baseURL ?? '',
      api: profile.api ?? '',
      models: normalizeModels(entry.provider, profile.models ?? []),
    })
  }
  return out
}
