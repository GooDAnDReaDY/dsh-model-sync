# 📦 @goodandready/dsh-model-sync

<div align="center">

<h3>Автоматическая синхронизация каталогов моделей и балансов API провайдеров</h3>

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

## ⚡ Обзор

**`dsh-model-sync`** автоматически синхронизирует списки доступных моделей и отслеживает остатки баланса на счетах API-провайдеров (OpenRouter, DeepSeek, Together, Ollama).

```mermaid
graph LR
    Trigger[⏰ Синхронизация по расписанию] --> Scanner[Движок dsh-model-sync]
    Scanner -->|Опрос эндпоинтов| Endpoints[OpenRouter / DeepSeek / Together / Ollama]
    Endpoints -->|Списки моделей и баланс| Scanner
    Scanner -->|Обновление на лету| Catalog[Каталог моделей DSH]
```

---

## 📦 Быстрая установка

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

---

## 📄 Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
