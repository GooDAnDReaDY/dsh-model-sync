# 📦 @goodandready/dsh-model-sync

<div align="center">

<h3>DeepSeek Harness 服务商模型目录动态同步与账户余额监控插件</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-model-sync"><img src="https://img.shields.io/npm/v/@goodandready/dsh-model-sync.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/GooDAnDReaDY/dsh-model-sync.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

</div>

---

## ⚡ 插件概览

**`dsh-model-sync`** 自动发现上游服务商最新模型并实时监控 API 账户额度消耗情况。

```mermaid
graph LR
    Trigger[⏰ 定时轮询调度] --> Scanner[dsh-model-sync 引擎]
    Scanner -->|API 端点探测| Endpoints[OpenRouter / DeepSeek / Together / Ollama]
    Endpoints -->|最新模型清单与余额数据| Scanner
    Scanner -->|动态刷新| Catalog[DSH 本地模型选单]
```

---

## 📦 安装指南

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

---

## 📄 开源协议

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
