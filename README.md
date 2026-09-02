# 📦 @goodandready/dsh-model-sync

<div align="center">

<h3>Dynamic LLM Model Catalog Synchronization & Automated Balance Monitoring for DeepSeek Harness</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-model-sync"><img src="https://img.shields.io/npm/v/@goodandready/dsh-model-sync.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="https://goodandready.app/"><img src="https://img.shields.io/badge/All_Author_Projects-goodandready.app-ff4500.svg?style=for-the-badge&logo=rocket&logoColor=white&labelColor=1a1a2e" alt="All Author Projects"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

</div>

---

## ⚡ Overview

**`dsh-model-sync`** keeps your **DeepSeek Harness** model catalog up-to-date with upstream AI providers. 

Instead of manually editing YAML configs whenever a provider launches a new model, adjusts context window limits, or changes pricing, `dsh-model-sync` automatically discovers new releases, updates capability metadata (`vision`, `tools`, `reasoning`, `embeddings`), tracks account balances, and reconciles models on the fly without server restarts.

```mermaid
graph LR
    subgraph Trigger [Scheduling & Manual Trigger]
        Cron[⏰ Background Polling Scheduler] --> Engine[dsh-model-sync Core Engine]
        WebUI[🖥️ Settings: Sync Now Button] --> Engine
    end

    subgraph Providers [25+ Upstream Providers]
        Engine --> Registry{Adapter Registry}
        Registry -->|Bearer Auth| P1[OpenAI / DeepSeek / OpenRouter / Groq]
        Registry -->|x-api-key Auth| P2[Anthropic Claude / Custom Gateways]
        Registry -->|query-key Auth| P3[Google Gemini]
        Registry -->|Local Probe| P4[Local Ollama / vLLM / SGLang]
    end

    subgraph Reconcile [Catalog Reconciler & Auditing]
        P1 --> Normalizer[Model Normalizer & Capabilities Tagger]
        P2 --> Normalizer
        P3 --> Normalizer
        P4 --> Normalizer
        Normalizer --> Diff[Sync Diff Tracker: Added / Deprecated]
        Diff --> Catalog[Active DSH Models Catalog]
    end

    style Trigger fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Providers fill:#181825,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4
    style Reconcile fill:#11111b,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## ✨ Key Features

* 🔄 **Automated Catalog Discovery**: Syncs model lists, aliases, context windows, and capability flags (`vision`, `tools`, `reasoning`, `embeddings`) across 25+ providers.
* 🌐 **25+ Built-in Provider Adapters**: Pre-configured discovery for OpenAI, Anthropic, Google, DeepSeek, xAI, OpenRouter, Groq, Mistral, Cerebras, Fireworks, HuggingFace, Moonshot, NVIDIA, Qwen, Together, Xiaomi MiMo, SiliconFlow, and local Ollama.
* 🔌 **Generic / Custom Adapter Support**: Connect arbitrary OpenAI-compatible `/v1/models` endpoints with configurable auth (`bearer`, `x-api-key`, `query-key`, `none`).
* 📊 **Balance & Quota Monitoring**: Queries upstream billing endpoints (where supported) to report account credit balances and prevent unexpected exhaustion.
* 📜 **Sync History & Diff Auditing**: Tracks all newly discovered models, deprecated IDs, and modified capabilities with timestamped diff logs in the Web UI.
* 🖥️ **Full Web GUI Panel (**Settings → Model Synchronization**)**:
  * Live status cards per provider with active model counters;
  * Instant "Sync Now" button for on-demand catalog refreshes;
  * Provider enable/disable toggles and custom endpoint inputs.

---

## 🛠️ Supported Discovery Providers

| Provider Identifier | Authentication Format | Capabilities Auto-Detection |
|---|---|---|
| `openai` | Bearer Token | `vision`, `tools`, `reasoning`, `embeddings` |
| `anthropic` | `x-api-key` header | `vision`, `tools`, `reasoning` |
| `google` | Query parameter / Key | `vision`, `tools`, `reasoning`, `embeddings` |
| `deepseek` | Bearer Token | `tools`, `reasoning` |
| `xai` | Bearer Token | `vision`, `tools`, `reasoning` |
| `openrouter` | Bearer Token | Multi-vendor model catalog with pricing & context limits |
| `groq` | Bearer Token | Ultra-fast inference catalog |
| `mistral` | Bearer Token | `tools`, `reasoning`, `vision` |
| `fireworks` | Bearer Token | Open-weights inference endpoints |
| `huggingface` | Bearer Token | Serverless Inference API catalog |
| `together` | Bearer Token | Open-source model catalog |
| `ollama` | Local HTTP (`none`) | Local offline model discovery (`/api/tags`) |
| `custom` | Configurable | Any custom OpenAI or Google compatible gateway |

---

## 📦 Quick Installation

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

> [!IMPORTANT]
> Restart DSH Web UI after installation (`systemctl --user restart dsh-web`) to activate background catalog synchronization.

---

## 🛠️ Enhancements & Fixes in v0.3.6

* 🔑 **Universal Credential Resolution (`credentialRef` & `apiKeyRef`)**:
  * Added full support for modern DSH `credentialRef` and `apiKeyRef` references across inventory detection, provider adapters, and OpenAI-compatible generic routes.
  * Providers configured via DSH Credentials Service are now accurately discovered and authenticated without requiring legacy `apiKeyEnv`.
* ♻️ **Lifecycle Cleanup for Deprecated Models**:
  * Fixed an issue where models previously marked as `deprecated` would remain indefinitely in settings when removed by the upstream provider. When `removeMissing: true` is enabled, missing deprecated models now cleanly transition to `removed` status once the grace period expires.
* ⏰ **Accurate Scheduler Inactive Status**:
  * Corrected `scheduler.status()` to return `nextRunAt: null` when background synchronization is disabled, avoiding misleading run times in the Web UI.
* 🛡️ **Web UI Resilience & Big Catalog Scalability**:
  * Eliminated potential UI crashes during model sorting by safely handling missing model display names.
  * Replaced spread operations on model arrays with iterative aggregations, preventing call stack overflow (`RangeError`) on massive catalogs (10,000+ models).
  * Surfaced detailed probe error messages in the UI when testing individual models via the `▶` button.
  * Localized cache expiration and offline status strings in Russian and English.
* ⚡ **Deterministic Model Diffing & HTTP Stream Safety**:
  * Implemented stable key-sorted serialization in `diffModels` and `sameModel` to eliminate false-positive diffs caused by non-deterministic JSON key order.
  * Added early stream destruction on oversized HTTP request bodies to prevent memory bloat.

---

## 🚀 Enhancements in v0.3.5

* ⏱️ **Adaptive Rate Limit & Retry-After Handling**:
  * Automatically parses HTTP headers `Retry-After` (in seconds or RFC dates) and `x-ratelimit-reset`.
  * Exponential backoff prioritizes the exact delay requested by upstream providers, eliminating unnecessary throttling.
  * Re-classified HTTP 429 errors under a dedicated `rate-limit` diagnostic label.
* 🔄 **Optimistic Concurrency & Conflict Auto-Recovery**:
  * Added automated retry loop for `SETTINGS_CONFLICT` (HTTP 409). When concurrent settings updates occur in DSH, the plugin seamlessly re-fetches the latest revision and reapplies the catalog mutations.
* 🎯 **Advanced Web UI Picker & Filtering**:
  * **Tokenized Smart Search**: Multi-word queries (`claude 3.5 sonnet`) match across model IDs, display names, tags, and descriptions simultaneously.
  * **Quick Filter Chips**: One-click toggles for `Context ≥ 100k` and `Cheap ≤ $1/1M` in addition to capability toggles (`Vision`, `Tools`, `Reasoning`, `Embeddings`).
  * **Batch Selection Controls**: One-click buttons to *Select all shown*, *Deselect all shown*, and *Invert selection*.
  * **Chunked Rendering / Pagination**: Renders models in batches of 50 to maintain smooth 60fps UI performance even with catalogs containing 1,000+ models.
  * **Deprecation Badges**: Models with scheduled retirement dates display an explicit countdown badge (`Deprecates in Nd`).
* 💾 **Storage & Metadata Optimizations**:
  * Robust context limit parser supporting suffix multipliers (`128k`, `1M`, `128,000`).
  * Automatic history compaction: historical snapshots older than the 5 latest sync runs have heavy before/after dumps pruned while retaining summary diffs, keeping `settings.yaml` ultra-compact.

---

## ⚙️ Configuration Reference (`settings.yaml`)

```yaml
dsh-model-sync:
  enabled: true
  syncIntervalMinutes: 60
  autoReconcile: true
  providers:
    openrouter:
      enabled: true
      keyEnv: OPENROUTER_API_KEY
    deepseek:
      enabled: true
      keyEnv: DEEPSEEK_API_KEY
    custom:
      enabled: false
      baseURL: http://127.0.0.1:8000/v1
      authType: bearer
      keyEnv: CUSTOM_API_KEY
```

---

## 📄 License

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
