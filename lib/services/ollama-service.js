/**
 * DeepSeek Harness Model Sync — Ollama Hub Domain Service (#268, #280)
 */

import { createOllamaManager } from '../ollama-manager.js'

export function createOllamaService({ fetchImpl = fetch, baseUrl } = {}) {
  const manager = createOllamaManager({ fetchImpl, baseUrl })
  return Object.freeze({
    ...manager,
    ollamaPs: manager.fetchOllamaPs,
    ollamaTags: manager.fetchOllamaTags,
    ollamaShow: manager.fetchOllamaModelInfo,
    ollamaUnload: manager.unloadOllamaModel,
    ollamaDelete: manager.deleteOllamaModel,
    ollamaPull: manager.startOllamaPull,
    ollamaPullStatus: manager.getOllamaPullStatus,
  })
}
