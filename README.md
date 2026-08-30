# 📦 @goodandready/dsh-model-sync

<div align="center">

[![npm version](https://img.shields.io/npm/v/@goodandready/dsh-model-sync.svg?style=flat-square)](https://www.npmjs.com/package/@goodandready/dsh-model-sync)
[![license](https://img.shields.io/github/license/GooDAnDReaDY/dsh-model-sync.svg?style=flat-square)](LICENSE)
[![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-6366f1.svg?style=flat-square)](https://github.com/topics/dsh-plugin)

**[ 🇬🇧 English ](#-english) • [ 🇷🇺 Русский ](#-русский) • [ 🇨🇳 中文 ](#-中文)**

</div>

---

<a name="-english"></a>
## 🇬🇧 English

Automated provider model catalog discovery and quota balance monitoring for DeepSeek Harness API-key providers.

### Features

- **Dynamic Model Discovery**: Queries provider endpoints (OpenRouter, DeepSeek, Together, Ollama) and updates the active model list in DSH.
- **Credit & Quota Tracking**: Displays real-time account balances and token consumption.
- **Filter Rules**: Hide deprecated or legacy models automatically.

### Install

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

---

<a name="-русский"></a>
<details open>
<summary><h2>🇷🇺 Русский (Полное руководство)</h2></summary>

Автоматическая синхронизация каталогов моделей и отслеживание балансов API для провайдеров DeepSeek Harness.

### Возможности

- **Динамическое обнаружение**: опрашивает API провайдеров (OpenRouter, DeepSeek, Together, Ollama) и обновляет списки моделей в интерфейсе DSH.
- **Балансы и квоты**: отображает остаток средств на счетах и статистику расхода токенов.
- **Фильтры моделей**: автоматическое скрытие устаревших версий.

### Установка

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

</details>

---

<a name="-中文"></a>
<details>
<summary><h2>🇨🇳 中文 (完整技术文档)</h2></summary>

DeepSeek Harness 服务商模型目录自动同步与额度监控插件。

### 核心亮点

- **动态模型发现**：自动请求服务商端点（OpenRouter、DeepSeek、Together、Ollama 等）并刷新 DSH 选单。
- **余额与额度追踪**：实时展示 API 账户可用余额与消耗统计。
- **自定义模型过滤**：自动隐藏旧版与弃用模型。

### 安装方法

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

</details>
