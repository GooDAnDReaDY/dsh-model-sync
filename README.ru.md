# 📦 @goodandready/dsh-model-sync

<div align="center">

<h3>Динамическая синхронизация каталогов моделей и автоматический мониторинг баланса для DeepSeek Harness</h3>

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

</div>

---

## ⚡ Обзор

**`dsh-model-sync`** обеспечивает автоматическую актуализацию каталога моделей **DeepSeek Harness** напрямую от подключенных провайдеров.

Вместо ручного редактирования YAML-файлов при выходе новых моделей, смене лимитов контекста или цен, плагин автоматически обнаруживает релизы, обновляет флаги возможностей (`vision`, `tools`, `reasoning`, `embeddings`), отслеживает остатки баланса и обновляет каталог на лету без перезапуска сервера.

```mermaid
graph LR
    subgraph Trigger [Планировщик и ручной запуск]
        Cron[⏰ Фоновый планировщик опроса] --> Engine[Ядро dsh-model-sync]
        WebUI[🖥️ Кнопка «Синхронизировать сейчас»] --> Engine
    end

    subgraph Providers [25+ Внешних провайдеров]
        Engine --> Registry{Реестр адаптеров}
        Registry -->|Авторизация Bearer| P1[OpenAI / DeepSeek / OpenRouter / Groq]
        Registry -->|Заголовок x-api-key| P2[Anthropic Claude / Кастомные шлюзы]
        Registry -->|Ключ query-key| P3[Google Gemini]
        Registry -->|Локальный опрос| P4[Локальная Ollama / vLLM / SGLang]
    end

    subgraph Reconcile [Сверка каталога и аудит]
        P1 --> Normalizer[Нормализация и разметка возможностей]
        P2 --> Normalizer
        P3 --> Normalizer
        P4 --> Normalizer
        Normalizer --> Diff[Журнал изменений: Добавлено / Устарело]
        Diff --> Catalog[Активный каталог моделей DSH]
    end

    style Trigger fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4
    style Providers fill:#181825,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4
    style Reconcile fill:#11111b,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4
```

---

## ✨ Ключевые возможности

* 🔄 **Автоматическое обнаружение моделей**: синхронизация списков моделей, контекстных окон и возможностей (`vision`, `tools`, `reasoning`, `embeddings`) для 25+ провайдеров.
* 🌐 **25+ встроенных адаптеров**: готовая поддержка OpenAI, Anthropic, Google, DeepSeek, xAI, OpenRouter, Groq, Mistral, Cerebras, Fireworks, HuggingFace, Moonshot, NVIDIA, Qwen, Together, Xiaomi MiMo, SiliconFlow и локальной Ollama.
* 🔌 **Универсальные кастомные адаптеры**: подключение любых сторонних OpenAI-совместимых эндпоинтов `/v1/models` (`bearer`, `x-api-key`, `query-key`, `none`).
* 📊 **Мониторинг баланса и квот**: опрос биллинга провайдеров (где доступно) для контроля остатка кредитов.
* 📜 **Журнал изменений (Diff Log)**: фиксация добавленных, удаленных и обновленных моделей с отметками времени.
* 🖥️ **Панель управления в Web GUI (**Настройки → Синхронизация моделей**)**:
  * Статус-карточки со счетчиками активных моделей по каждому провайдеру;
  * Кнопка «Синхронизировать сейчас» для мгновенного обновления;
  * Переключатели провайдеров и ввод пользовательских адресов.

---

## 📦 Быстрая установка

```bash
dsh plugin --profile web add @goodandready/dsh-model-sync
```

---

## 🛠️ Улучшения и исправления в v0.3.6

* 🔑 **Универсальное разрешение учетных данных (`credentialRef` и `apiKeyRef`)**:
  * Добавлена полная поддержка ссылок `credentialRef` и `apiKeyRef` в модулях инвентаря, реестре адаптеров и generic-маршрутах OpenAI-совместимых провайдеров.
  * Провайдеры, настроенные через DSH Credentials Service, теперь корректно обнаруживаются и аутентифицируются без необходимости обязательного наличия `apiKeyEnv`.
* ♻️ **Очистка устаревших моделей в жизненном цикле**:
  * Исправлена ошибка, из-за которой модели в статусе `deprecated` оставались в конфигурации бессрочно после их удаления провайдером. При флаге `removeMissing: true` такие модели теперь гарантированно переводятся в статус `removed` по истечении grace-периода.
* ⏰ **Точный статус неактивного планировщика**:
  * Исправлен `scheduler.status()`: при отключённой фоновой синхронизации `nextRunAt` теперь возвращает `null`, исключая вводящие в заблуждение даты следующего запуска в Web UI.
* 🛡️ **Надежность и масштабируемость Web UI**:
  * Защита от сбоев сортировки при отсутствии поля `name` у модели.
  * Замена spread-операций на итеративную агрегацию при вычислении экстремумов контекста и цены, что предотвращает переполнение стека (`RangeError`) на огромных каталогах (10 000+ моделей).
  * Детальный вывод текста ошибки при тестировании модели по кнопке `▶`.
  * Локализация срока давности кеша в карточке провайдера.
* ⚡ **Детерминированное сравнение каталогов и безопасность потоков**:
  * Реализована стабильная сортировка ключей перед сравнением моделей, исключающая фиктивные diff-записи из-за произвольного порядка ключей в JSON.
  * Добавлено прерывание сетевого потока при превышении лимита размера тела HTTP-запроса для защиты от утечек памяти.

---

## 🚀 Новые возможности в v0.3.5

* ⏱️ **Адаптивная обработка Rate Limit и Retry-After**:
  * Автоматический парсинг HTTP-заголовков `Retry-After` (в секундах и формате RFC-дат) и `x-ratelimit-reset`.
  * При повторах задержка выставляется строго по требованию провайдера.
  * Ошибки 429 классифицируются в отдельную категорию `rate-limit`.
* 🔄 **Автоматическое разрешение конфликтов настроек**:
  * Добавлен цикл повторов для `SETTINGS_CONFLICT` (HTTP 409). При параллельных правках конфигурации DSH плагин автоматически перечитывает ревизию и накладывает изменения без ошибок.
* 🎯 **Оптимизация панели выбора моделей в Web UI**:
  * **Токенизированный умный поиск**: Слова поискового запроса (`claude 3.5 sonnet`) сопоставляются независимо по ID, названиям, тегам и описаниям моделей.
  * **Быстрые фильтр-чипы**: Фильтры `Контекст ≥ 100k` и `Дешевые ≤ $1/1M` в дополнение к фильтрам возможностей (`Зрение`, `Инструменты`, `Рассуждение`, `Эмбеддинги`).
  * **Массовый выбор**: Кнопки *Выбрать все показанные*, *Снять выбор с показанных*, *Инвертировать выбор*.
  * **Порционный рендеринг (пагинация)**: Отображение порциями по 50 моделей с кнопкой «Показать ещё» для плавной работы интерфейса в каталогах с 1000+ моделями.
  * **Бейджи устаревания моделей**: Для моделей с датой вывода из эксплуатации выводится обратный отсчет (`Устареет через N дн.`).
* 💾 **Хранение и парсинг метаданных**:
  * Корректный разбор числовых значений с запятыми и суффиксами (`128k`, `1M`, `128,000`).
  * Автоматическая компактификация: снимки каталогов старше 5 последних запусков очищаются от тяжелых дампов, сохраняя diff-аудит и компактность `settings.yaml`.

---

## ⚙️ Пример конфигурации (`settings.yaml`)

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

## 📄 Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)
