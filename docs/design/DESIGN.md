# DESIGN.md — dsh-model-sync

## Product / Purpose
- **Назначение**: Автоматическая синхронизация, обнаружение и управление каталогами LLM-моделей для провайдеров DeepSeek Harness (DSH).
- **Аудитория**: Пользователи и администраторы DSH, использующие API-key провайдеры (OpenAI, Anthropic, Google, Ollama, OpenRouter, Groq, DeepSeek, Mistral и др.).
- **Статус**: Активный production-плагин (@goodandready/dsh-model-sync).

## User Surfaces
- **Web/UI**: Карточка настроек плагина во вкладке «Настройки → Плагины → Настройки плагинов» (`settings.plugin.item`, key: `dsh-model-sync`). Не регистрирует отдельный раздел бокового меню верхнего уровня.
- **DSH UI / settings / slots**:
  - Слот `settings.plugin.item` с `key: 'dsh-model-sync'`, `locale: 'dsh-model-sync'`, инжектирует `{ ctx }`.
  - Привязка конфигурации через реактивный `ctx.settingsScope.bind({ namespace: 'dsh-model-sync' })`.
  - Статусы снимка: `ready`, `loading`, `unavailable`.
- **API**:
  - `GET /dsh-model-sync/status` — статус провайдеров, моделей, планировщика и отчетов.
  - `POST /dsh-model-sync/run` — запуск обнаружения (dryRun / apply).
  - `GET /dsh-model-sync/credentials` — диагностика ключей.
  - `POST /dsh-model-sync/health` — проверка доступности провайдеров.
  - `POST /dsh-model-sync/selection` — выбор активных моделей.
  - `POST /dsh-model-sync/policy` — политики фильтрации (включая лимиты цен и контекста).
  - `POST /dsh-model-sync/batch-try` — пакетная проверка доступности выбранных моделей с параллелизмом.
  - `GET /dsh-model-sync/export` — экспорт полной конфигурации каталогов, политик, выборок и алиасов в JSON.
  - `POST /dsh-model-sync/import` — импорт конфигурации и безопасное применение настроек.
  - `GET /dsh-model-sync/aliases` — получение карты пользовательских алиасов моделей.
  - `POST /dsh-model-sync/aliases` — назначение или удаление алиаса модели.
  - `GET /dsh-model-sync/history` — история синхронизаций и откат.
- **CLI**: Отсутствует (управление через UI и REST API DSH).
- **Документация**: `README.md`, `README.ru.md`, `docs/`.

### Политика безопасности HTTP API (Security & Loopback)
- **Разделение Read / Write**:
  - **Read-маршруты** (`GET /status`, `GET /export`, `GET /aliases`, `GET /history`, `GET /credentials`, `GET /report`, `GET /notifications`): защищены от cross-site браузерных атак (`sec-fetch-site !== 'cross-site'`, проверка совпадения `Origin` / `Referer` с `Host`).
  - **Write-маршруты** (`POST /run`, `POST /try`, `POST /batch-try`, `POST /import`, `POST /aliases`, `POST /selection`, `POST /policy`, `POST /health`, `POST /history/rollback`, `POST /notifications/*`): строго требуют подтвержденный `isLoopbackAddress` клиента (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`, `localhost`). Любые запросы от внешних сетевых адресов или запросы без браузерных заголовков с внешних узлов немедленно отклоняются со статусом `403 Forbidden`.


## Visual Direction
- **Атмосфера**: Строгий нативный интерфейс DSH, дизайн-токены `--dsw-*`, высокая плотность данных без визуального шума.
- **Утверждённые референсы**: Карточки настроек ядра DSH (`BashCard`, `AgentLoopCard`).
- **Не копировать**: Сторонние CSS-фреймворки, переопределения цветов вне CSS-переменных темы `--dsw-*`.

## Foundations
- **Цвета и роли**:
  - Границы: `var(--dsw-alias-border-l2)`, `var(--dsw-alias-border-primary)`
  - Фон: `var(--dsw-alias-bg-layer-1)`, `var(--dsw-alias-bg-layer-2)`, `var(--dsw-alias-bg-layer-3)`
  - Текст: `var(--dsw-alias-label-primary)`, `var(--dsw-alias-label-secondary)`, `var(--dsw-alias-label-tertiary)`
  - Акцент / Бренд: `var(--dsw-alias-brand-primary)`
  - Статусы: `var(--dsw-alias-state-success-primary)`, `var(--dsw-alias-state-error-primary)`, `var(--dsw-alias-state-warning-primary)`
- **Типографика**: Нативные системные шрифты DSH, размеры 11px–15px, строгая иерархия.
- **Сетка, отступы, responsive**: Внутренние отступы 10–14px, адаптивная сетка провайдеров (`@media (max-width:540px)` одноколоночный вид).
- **Accessibility**: Семантические кнопки `<button type="button">`, `aria-expanded` для сворачиваемых секций, фокусные рамки `focus-visible`.

## Components And States
- **Компоненты**:
  - `ModelSyncCard`: Сворачиваемая карточка плагина с шевроном ядра и счетчиком новых моделей.
  - `ModelSyncSection`: Основное тело настроек (тулбар, кнопки действий, список провайдеров, выбор моделей, политики, планировщик, диагностика ключей, история).
  - `SchedulerSettings`: Форма конфигурации фонового планировщика (`scheduleEnabled`, `intervalMinutes`, `autoApply`).
- **Loading / empty / error / success**:
  - Loading: текст `t.loading` и disabled состояния кнопок.
  - Empty: явные сообщения `t.noProviders`, `t.noModels`, `t.noNotifications`, `t.noHistory`.
  - Error: подсветка ошибок `var(--dsw-alias-state-error-primary)`.
  - Success: индикаторы `ready`, бейджи латентности, сообщения об успешном сохранении.
- **Формы, валидация и действия**:
  - Все поля сохраняются через `scope.set(key, value)`.
  - Сбор ошибок по всем полям (не прерывать на первой ошибке).

## User Flows
- **Просмотр и выбор моделей**: Поиск по `id/name/tag`, фильтрация по capabilities, быстрая сортировка (`Name`, `Price`, `Context`, `Date`), сохранение выбора.
- **Фоновый планировщик**: Настройка интервала синхронизации и автоприменения, сохранение в `settingsScope`.
- **Откат и аудит**: Просмотр истории диффов, откат снимка каталога при необходимости.

## Do / Don't
- **Do**:
  - Использовать только токены `--dsw-*`.
  - Канонические строки плагина хранить в словарях `en` и `zh` в `lib/client.js`.
  - Русскоязычная локализация регистрируется через внешний пакет `dsh-russian-lang` (Issue #191) и инжектируется во время выполнения.
  - Поддерживать изоляцию пакета: не включать неисполняемые файлы и документацию в релиз через `.npmignore`.
  - Проверять статус снимка настроек (`ready`, `loading`, `unavailable`).
- **Don't**:
  - Хардкодить строки на одном языке.
  - Пропускать ключи локализации (например, `t.noHistory`).
  - Оставлять поля конфигурации схемы без UI в карточке настроек.

## Changelog
- **2026-09-17**: Устранение уязвимости проверки источника и пустых catch (#130):
  - Функция `trusted(req)` дополнена проверкой `isLoopbackAddress(req.socket?.remoteAddress)`.
  - Все мутирующие write-эндпоинты (`POST`) требуют обязательный loopback адрес клиента.
  - Заменены пустые блоки `catch {}` на безопасную обработку с логированием `bestEffort`, устранен блокирующий `FAIL` preflight.
- **2026-09-13** (v0.3.14): Расширение функционала (пакетный аудит, фильтры цены/контекста, экспорт/импорт, алиасы) и языковой стандарт (#126):
  - **Языковой стандарт**: Каноническая поддержка `en` и `zh` непосредственно в кодовой базе плагина. Хардкодный словарь `ru` удален из `lib/client.js` и перенесен в каталог переводов `goodandready/dsh-russian-lang` (#191).
  - **Изоляция релиза**: Создан `.npmignore`, предотвращающий попадание тестов, планов и дополнительной документации в публикуемый npm-пакет.
  - **Пакетная проверка доступности (`batch-try`)**: Эндпоинт `POST /dsh-model-sync/batch-try` и кнопка «Test Selected» в UI. Автоматическая проверка латентности с бейджами и быстрая деселекция недоступных моделей.
  - **Фильтрация по стоимости и контексту**: Опциональные политики в настройках провайдера (`enableCostFilter`, `maxPricePerMillion`, `enableContextFilter`, `minContextTokens`) для автоматического отсева слишком дорогих или моделей с малым контекстным окном.
  - **Экспорт и импорт конфигурации**: Эндпоинты `GET /dsh-model-sync/export` и `POST /dsh-model-sync/import` с UI-интерфейсом для бэкапа и переноса настроек моделей, политик, выборок и алиасов.
  - **Пользовательские алиасы моделей**: Эндпоинты `GET/POST /dsh-model-sync/aliases` и карточка управления для привязки коротких мнемонических имен к парам «провайдер / модель».
- **2026-09-12**: Оптимизация скорости, фонового трафика, UI поиска и распознавания возможностей моделей (#124):
  - **HTTP ETag / 304**: Реализован слабый ETag (`W/"..."`) для эндпоинта `GET /dsh-model-sync/status`. При регулярном 15-секундном опросе UI возвращается `304 Not Modified` с пустым телом, устраняя холостую сериализацию JSON и сетевой трафик.
  - **Upstream Conditional Requests**: Поддержка `If-None-Match` и `If-Modified-Since` в generic и declarative адаптерах. При ответе `304` от upstream провайдера синхронизатор мгновенно использует закэшированный каталог моделей без повторного парсинга.
  - **Debounced Search & useMemo**: Внедрен 150ms debounce для строки поиска в пикере моделей `ModelPicker` и мемоизация `React.useMemo` для фильтрации и сортировки каталога моделей, устраняя микрофризы ввода при работе с большими каталогами.
  - **Capabilities Detection**: Добавлено распознавание специализированных возможностей моделей современного поколения (`code`, `reasoning` / `thinking` для DeepSeek-R1, o1/o3-mini, Qwen Coder) в `lib/models.js`, `lib/policy.js` и адаптерах.
  - **Backoff Jitter**: Внедрен экспоненциальный джиттер (`0.5 - 1.0` multiplier) при повторах сетевых запросов к провайдерам, предотвращающий thundering herd.
- **2026-09-10**: Унификация визуального стиля по образцу `dsh-clinebot`, внедрение `ErrorBoundary` и расширение тестов (#122):
  - Добавлен защитный компонент `ErrorBoundary` для изоляции сбоев рендеринга настроек плагина с кнопкой повтора (Retry).
  - Внедрены карточки разделов и элементы в едином стиле DSH-плагинов (`.dms-section-card`, `.dms-badge`, `.dms-badge-ok/warn/bad`, `.dms-btn-primary`, `.dms-btn-danger`, `.dms-probe-result`).
  - Статусы готовности, доступности и состояния провайдеров оформлены аккуратными цветными pill-бейджами.
  - Кнопки первичных действий оформлены как акцентные (`.dms-btn-primary`), кнопки отката — как предупреждающие (`.dms-btn-danger`).
  - Добавлено полное тестовое покрытие метода `tryModel`, HTTP-эндпоинта `/dsh-model-sync/try` и маршрутов `/credentials`, `/report`, `/notifications`, `/history`. Общее число тестов увеличено до 100 с покрытием строк 96.01%.
- **2026-09-10**: Удаление fallback в `settings.section` (верхний уровень настроек) и безопасный доступ к сервисам Cordis через `ctx.get(...)` (#119): плагин регистрирует только стандартную карточку плагина `settings.plugin.item`, исключены непрямые обращения к proxy-свойствам контекста `ctx.llm` и `ctx.settings`.
- **2026-09-08**: Внутренняя оптимизация гигиены, опрашивания UI и runtime diff (#117): дедупликация UI polling между картой и секцией при раскрытии, пауза polling при `document.hidden`, шорткат проверки диффа каталогов в `synchronizer.js`, чистка неиспользуемых функций и правил `.gitignore`.
- **2026-09-08**: Комплексная оптимизация хранения истории, планировщика и UX (#114): компактизация снимков моделей в `settings.yaml`, мгновенный запуск первого синка планировщика, валидация regex-шаблонов политик в UI.
- **2026-09-07**: Устранение оверинжиниринга и повышение стабильности (#111): сериализация сохранений `saveConfig`, ужесточение проверок `trusted(req)` от CSRF, выравнивание атрибута `data-dsh-plugin`.
- **2026-09-06**: Устранение замечаний аудита DSH (#107, #108, #109): добавлен `settingsScope` для управления планировщиком, добавлен ключ `noHistory`, локализован пикер моделей.

### 6.13 Plugin Self-Update Subsystem

To align with DSH ecosystem standard for one-click plugin updates from UI settings:
- **Module**: `lib/updater.js`.
- **Endpoints**: `GET /api/dsh-model-sync/update`, `HEAD /api/dsh-model-sync/update`, `POST /api/dsh-model-sync/update` (also mirrored at `/dsh-model-sync/update`).
- **Security**: Strict loopback verification via `isTrustedUpdateRequest`:
  - Enforces `x-dsh-plugin-update: 1` header.
  - Enforces socket remote address is loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`, `localhost`).
  - Enforces origin is valid loopback and matches host header.
  - Enforces `sec-fetch-site` is not cross-site.
- **SemVer Comparison**: Supports SemVer 2.0.0 including core numbers and prerelease transitions (e.g. `0.4.0-beta.1` -> `0.4.0`).
- **Concurrency**: Prevents concurrent updates via 409 conflict.
- **UI**: Embedded `UpdaterSection` in settings card with current version, latest version badge, and one-click update button.

### 6.14 Client Injected Services Contract

Per the unified DSH plugin standard, any plugin delivering a web-side client bundle (`lib/client.js`) MUST explicitly declare the client-side packages providing injected services in `package.json` under `dsh.client.inject`:
- `@deepseek-ai/dsh-client-locale`: provides `locale` and translation registration.
- `@deepseek-ai/dsh-client-ui-slots`: provides `slots` for UI extension points (`settings.plugin.item`).
- `@deepseek-ai/dsh-client-ui-settings`: provides `settingsScope` / settings binding.

An empty list `inject: []` is forbidden as it relies on ambient build assembly rather than declared contracts.

### 6.15 Strict Theme Variable Policy

In conformance with DSH UI design guidelines:
- All CSS styles and components in `lib/client.js` exclusively use DSH design tokens (`--dsw-alias-state-*`, `--dsw-alias-bg-*`, `--dsw-alias-border-*`, `--dsw-alias-label-*`, `--dsw-alias-brand-*`).
- Hardcoded `#hex` colors and standalone `rgba(...)` color values are strictly prohibited.
- This ensures full visual fidelity, seamless contrast, and native look-and-feel across both light and dark themes.\n
### 6.16 Module Decomposition and File Size Policy

In accordance with DSH authoring guidelines (< 600 lines per module):
- **`lib/synchronizer.js`**: Core synchronization logic decomposed into focused modular components:
  - `lib/synchronizer-helpers.js`: Runtime context inspection, reliability options calculation, and diagnostic/error formatting (~115 lines).
  - `lib/synchronizer-transfer.js`: Full configuration export/import backup engine and model alias dictionary management (~120 lines).
  - `lib/synchronizer.js` retained as coordinator (~575 lines, well below the 600 line threshold).
- **`lib/client.js` architectural single-bundle requirement**:
  - `lib/client.js` is the single self-contained browser bundle required by the DSH `window.__ModuleLoader__` web runtime. DSH browser plugin loader does not support relative CommonJS/ESM module resolution at runtime for browser assets without an external bundle pipeline, and per DSH standard (and preflight check #7), `lib/client.js` must remain the single deliverable artifact.

### 6.17 Версия 0.4.0 и статус релиза

- **Версия пакета**: 0.4.0 (`@goodandready/dsh-model-sync`).
- **One-click updater**: Реализован в `lib/updater.js` с loopback-защитой, проверкой SemVer 2.0.0 и регистрацией UI в `UpdaterSection`.
- **Безопасность**: Fail-closed проверка loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) на всех mutating endpoints.
- **Оформление UI**: 100% дизайн-токенов темы DSH (0 hex, 0 rgba).
- **Декомпозиция**: `synchronizer.js` разбит на 3 вспомогательных модуля (`synchronizer-helpers.js`, `synchronizer-transfer.js`, `synchronizer-prober.js`).
- **Чистота дистрибутива**: Исключены dev- и planning-артефакты, размер npm-пакета < 70 KiB.

### 6.18 Регламент хранения локальной планировочной документации (#143)

- **Назначение**: Внутренние файлы планирования (`.planning/`), планы задач (`docs/plans/`), архитектурные заметки (`docs/architecture/`), инструкции агентов (`AGENTS.md`, `index.md`) и вспомогательные скрипты (`deploy.sh`) сохраняются локально на диске разработчика в рабочей копии проекта.
- **Исключение из git и npm**: Данные файлы строго не попадают в систему контроля версий (git) и не включаются в публикуемый npm-пакет. Это обеспечивается правилами в `.gitignore` и `.npmignore`.
- **Непрерывность контекста**: При рефакторинге и очистке релизного дерева файлы исключаются из отслеживания (`git rm --cached`), но сохраняются физически на диске для обеспечения преемственности истории планирования, заметок `findings.md`, `progress.md` и `task_plan.md`.
