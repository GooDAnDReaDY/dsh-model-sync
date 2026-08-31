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
