# 📦 @goodandready/dsh-model-sync

<div align="center">

<h3>Динамическая синхронизация каталогов LLM-моделей и автоматический мониторинг баланса для DeepSeek Harness</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-model-sync"><img src="https://img.shields.io/npm/v/@goodandready/dsh-model-sync.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981.svg?style=for-the-badge&color=10b981&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="https://goodandready.app/"><img src="https://img.shields.io/badge/Все_проекты_автора-goodandready.app-ff4500.svg?style=for-the-badge&logo=rocket&logoColor=white&labelColor=1a1a2e" alt="Все проекты автора"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a>
</p>

<table align="center">
  <tr>
    <td align="center">
      ⭐ <strong>Если вам нравится этот плагин, поставьте ему Star на GitHub</strong> — это покажет мне, что плагин полезен, и добавит мотивации продолжать его развитие.
      <br><br>
      🐛 <strong>Если вы нашли баг или хотите предложить новую функцию</strong>, создайте Issue на GitHub на любом языке — я рассмотрю предложение и реализую полезные улучшения в одной из следующих версий плагина.
    </td>
  </tr>
</table>

</div>

---

## ⚡ Обзор

**`dsh-model-sync`** поддерживает каталог моделей **DeepSeek Harness** в актуальном состоянии с апстрим AI-провайдерами.

Вместо ручного редактирования YAML-файлов при выпуске провайдером новой модели, изменении размера контекста или цен, `dsh-model-sync` автоматически обнаруживает новые релизы, обновляет метаданные возможностей (`vision`, `tools`, `reasoning`, `embeddings`), отслеживает баланс аккаунтов, управляет видимостью моделей в интерфейсе и синхронизирует модели на лету без перезапуска сервера.

```mermaid
graph LR
    subgraph Trigger [Расписание и ручной запуск]
        Cron[⏰ Фоновый планировщик опроса] --> Engine[Ядро dsh-model-sync]
        WebUI[🖥️ Настройки: Кнопка Sync Now] --> Engine
    end

    subgraph Providers [25+ Апстрим-провайдеров]
        Engine --> Registry{Реестр адаптеров}
        Registry -->|Bearer Auth| P1[OpenAI / DeepSeek / OpenRouter / Groq]
        Registry -->|x-api-key Auth| P2[Anthropic Claude / Пользовательские шлюзы]
        Registry -->|query-key Auth| P3[Google Gemini]
        Registry -->|Локальный опрос| P4[Локальные Ollama / vLLM / SGLang]
        Registry -->|CommandCode API| P5[Command Code / visibleModels]
        Registry -->|Опрос подписки| P6[План подписки ClineBot]
    end

    subgraph Reconcile [Сверка каталога и аудит]
        P1 --> Normalizer[Нормализатор моделей и тегирование возможностей]
        P2 --> Normalizer
        P3 --> Normalizer
        P4 --> Normalizer
        P5 --> Normalizer
        P6 --> Normalizer
        Normalizer --> Diff[Трекер изменений: Добавлено / Устарело]
        Diff --> Catalog[Активный каталог моделей DSH и visibleModels]
    end

    style Trigger fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Providers fill:#181825,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4
    style Reconcile fill:#11111b,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## ✨ Ключевые возможности

* 🔄 **Автоматическое обнаружение каталога**: синхронизация списков моделей, алиасов, контекстных окон и флагов возможностей (`vision`, `tools`, `reasoning`, `embeddings`) для 25+ провайдеров.
* 🛡️ **Совместимость шаблонов чата и ролей Minijinja**: автоматическая установка `compat.supportsDeveloperRole: false` для открытых моделей Groq (Qwen, Llama, Mistral, Gemma, DeepSeek) и DeepSeek API, предотвращая ошибки 400 `Unexpected message role` для reasoning-моделей с сохранением пользовательских настроек.
* 🌐 **25+ встроенных адаптеров провайдеров**: готовая поддержка OpenAI, Anthropic, Google, DeepSeek, xAI, OpenRouter, Groq, Mistral, Cerebras, Fireworks, HuggingFace, Moonshot, NVIDIA, Qwen, Together, Xiaomi MiMo, SiliconFlow, Command Code, ClineBot и локальной Ollama.
* 🎛️ **Управление моделями Command Code**: полное обнаружение моделей Command Code с возможностью выбора чекбоксами в UI и автоматической синхронизацией `visibleModels` в настройках `llm-commandcode`.
* 🎯 **Синхронизация тарифного плана ClineBot**: выделенный адаптер, опрашивающий `GET /users/me/plan`, который получает исключительно модели, входящие в активную подписку, исключая появление сотен недоступных моделей.
* 🔌 **Поддержка универсальных и кастомных адаптеров**: подключение произвольных OpenAI-совместимых эндпоинтов `/v1/models` с настраиваемой авторизацией (`bearer`, `x-api-key`, `query-key`, `none`).
* 📊 **Мониторинг баланса и квот**: опрос биллинговых эндпоинтов провайдеров (где поддерживается) для предотвращения неожиданного исчерпания средств.
* 📜 **История синхронизации и аудит диффов**: отслеживание всех добавленных моделей, устаревших ID и изменённых возможностей с журналом изменений во времени.
* 🖥️ **Полноценная панель Web UI (**Настройки → Синхронизация моделей**)**:
  * Карточки статуса по каждому провайдеру со счётчиками активных моделей;
  * Кнопка мгновенной синхронизации «Sync Now»;
  * Выбор и скрытие моделей чекбоксами;
  * Переключатели включения/отключения провайдеров и ввод кастомных эндпоинтов.

---

## 🛠️ Поддерживаемые провайдеры

| Идентификатор провайдера | Формат авторизации | Автоопределение возможностей и примечания |
|---|---|---|
| `openai` | Bearer Token | `vision`, `tools`, `reasoning`, `embeddings` |
| `anthropic` | Заголовок `x-api-key` | `vision`, `tools`, `reasoning` |
| `google` | Query-параметр / Ключ | `vision`, `tools`, `reasoning`, `embeddings` |
| `deepseek` | Bearer Token | `tools`, `reasoning` |
| `xai` | Bearer Token | `vision`, `tools`, `reasoning` |
| `openrouter` | Bearer Token | Мультипровайдерный каталог с ценами и контекстными лимитами |
| `groq` | Bearer Token | `tools`, `reasoning`, `vision`, `supportsDeveloperRole: false` |
| `mistral` | Bearer Token | `tools`, `reasoning`, `vision` |
| `commandcode` | Bearer Token | Каталог `https://api.commandcode.ai/provider/v1/models` с сохранением выбора в `visibleModels` для `llm-commandcode` |
| `clinebot` | Bearer Token | Опрос активного тарифного плана (`/users/me/plan`), синхронизация строго включённых в подписку моделей |
| `fireworks` | Bearer Token | Эндпоинты открытых весов |
| `huggingface` | Bearer Token | Каталог Serverless Inference API |
| `together` | Bearer Token | Каталог моделей Open-Source |
| `ollama` | Локальный HTTP (`none`) | Локальное обнаружение офлайн-моделей (`/api/tags`) |
| `custom` | Настраиваемый | Любой кастомный шлюз, совместимый с OpenAI или Google |

---

## 📦 Быстрая установка

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

> [!IMPORTANT]
> Перезапустите Web UI DSH после установки (`systemctl --user restart dsh-web`), чтобы активировать фоновую синхронизацию каталогов.

---

## ⚙️ Конфигурация (`settings.yaml`)

```yaml
dsh-model-sync:
  enabled: true
  syncIntervalMinutes: 60
  autoReconcile: true
  enableBalanceChecks: true
  providers:
    commandcode:
      enabled: true
    clinebot:
      enabled: true
```

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Главный переключатель фоновой синхронизации |
| `syncIntervalMinutes` | `number` | `60` | Периодичность опроса провайдеров (в минутах) |
| `autoReconcile` | `boolean` | `true` | Автоматически применять обнаруженные модели к активному каталогу |
| `enableBalanceChecks` | `boolean` | `true` | Опрашивать биллинговые эндпоинты при наличии поддержки |
| `providers.<id>.enabled`| `boolean` | `true` | Включение или отключение обнаружения для конкретного провайдера |

---

## 📄 Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
