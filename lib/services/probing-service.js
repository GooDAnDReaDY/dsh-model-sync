/**
 * DeepSeek Harness Model Sync — Capability Probing & Latency Radar Domain Service (#263, #280)
 */

import path from 'node:path'
import { createCapabilityProber } from '../capability-prober.js'
import { createModelProber } from '../synchronizer-prober.js'
import { llmOf, profileOf, settingsOf } from '../synchronizer-helpers.js'
import { resolveStateDir } from '../state-store.js'

export function createProbingService({
  ctx,
  providers = () => [],
  health = async () => ({ results: [] }),
  selectAdapter = () => null,
  fetchImpl = fetch,
  probeModel,
  storagePath = path.join(resolveStateDir(), 'verified-capabilities.json'),
} = {}) {
  const prober = createModelProber({
    health,
    getProviderCatalog: (p) => {
      const row = providers().find((item) => item.provider === p)
      return row?.availableModels || row?.models || []
    },
    probeModel: probeModel ?? (async ({ provider, model, signal }) => {
      const llm = llmOf(ctx)
      if (typeof llm?.stream === 'function') {
        const stream = await llm.stream({
          provider,
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
        }, { signal })
        if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
          for await (const _chunk of stream) {
            break
          }
        }
        return { ok: true }
      }
      const profile = profileOf(settingsOf(ctx), provider)
      const adapter = selectAdapter(profile)
      if (typeof adapter?.probeModel === 'function') {
        return adapter.probeModel(profile, model, { signal, fetchImpl })
      }
      const h = await health({ provider, model, signal })
      const entry = h?.results?.find((r) => r.provider === provider)
      if (entry?.status !== 'ok') {
        const err = new Error(entry?.message || 'provider health failed: ' + entry?.status)
        if (entry?.status === 'circuit-open') err.status = 503
        throw err
      }
      return { ok: true }
    }),
  })

  const capabilityProber = createCapabilityProber({
    getCatalog: (p) => {
      if (p) {
        const row = providers().find((item) => item.provider === p)
        return row?.availableModels || row?.models || []
      }
      const list = []
      for (const prov of providers()) {
        const models = prov?.availableModels || prov?.models || []
        for (const m of models) {
          list.push({ provider: prov.provider, id: typeof m === 'string' ? m : m?.id })
        }
      }
      return list
    },
    inferFn: async ({ provider, model, payload, signal }) => {
      const llm = llmOf(ctx)
      if (typeof llm?.stream === 'function') {
        const stream = await llm.stream({
          provider,
          model,
          messages: payload?.messages || [{ role: 'user', content: 'ping' }],
          tools: payload?.tools,
          tool_choice: payload?.tool_choice,
          response_format: payload?.response_format,
          max_tokens: payload?.max_tokens || 16,
        }, { signal })
        let content = ''
        const toolCalls = []
        if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
          for await (const chunk of stream) {
            if (chunk?.delta?.content) content += chunk.delta.content
            if (chunk?.delta?.tool_calls) toolCalls.push(...chunk.delta.tool_calls)
          }
        }
        return { content, tool_calls: toolCalls, choices: [{ message: { content, tool_calls: toolCalls } }] }
      }
      throw Object.assign(new Error('llm service is unavailable for capability probing'), { code: 'llm-unavailable' })
    },
    storagePath,
    logger: ctx?.logger,
  })

  return Object.freeze({
    ...prober,
    getModelProbes: prober.getModelProbes,
    getLatencyRadar: prober.getLatencyRadar,
    getLatencyHistory: prober.getLatencyHistory,
    probeModelCapabilities: capabilityProber.probeModelCapabilities,
    probeProviderCapabilities: capabilityProber.probeProviderCapabilities,
    probeCapabilitiesForProvider: capabilityProber.probeProviderCapabilities,
    probeAllCapabilities: capabilityProber.probeAllCapabilities,
    getCapabilityStatus: capabilityProber.getStatus,
    getProbingStatus: capabilityProber.getStatus,
    getVerifiedCapabilities: capabilityProber.getVerifiedCapabilities,
    setVerifiedCapabilities: capabilityProber.setVerifiedCapabilities,
    clearVerifiedCapabilities: capabilityProber.clearVerifiedCapabilities,
  })
}
