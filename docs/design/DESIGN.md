# DESIGN.md — dsh-model-sync

## Product / Purpose
- **Назначение**: Автоматическая синхронизация, обнаружение и управление каталогами LLM-моделей для провайдеров DeepSeek Harness (DSH).
- **Аудитория**: Пользователи и администраторы DSH, использующие API-key провайдеры (OpenAI, Anthropic, Google, Ollama, OpenRouter, Groq, DeepSeek, Mistral и др.).
- **Статус**: Активный production-плагин (@goodandready/dsh-model-sync).

## User Surfaces
- **Web/UI**: Карточка настроек плагина во вкладке «Настройки → Плагины → Настройки плагинов» (`settings.plugin.item`, key: `dsh-model-sync`). Запасной слот: `settings.section` (order: 25).
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
  - `POST /dsh-model-sync/policy` — политики фильтрации.
  - `GET /dsh-model-sync/history` — история синхронизаций и откат.
- **CLI**: Отсутствует (управление через UI и REST API DSH).
- **Документация**: `README.md`, `README.ru.md`, `docs/`.

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
  - Все пользовательские строки выносить в словари `en` и `ru`.
  - Проверять статус снимка настроек (`ready`, `loading`, `unavailable`).
- **Don't**:
  - Хардкодить строки на одном языке.
  - Пропускать ключи локализации (например, `t.noHistory`).
  - Оставлять поля конфигурации схемы без UI в карточке настроек.

## Changelog
- **2026-09-08**: Комплексная оптимизация хранения истории, планировщика и UX (#114): компактизация снимков моделей в `settings.yaml`, мгновенный запуск первого синка планировщика, валидация regex-шаблонов политик в UI.
- **2026-09-07**: Устранение оверинжиниринга и повышение стабильности (#111): сериализация сохранений `saveConfig`, ужесточение проверок `trusted(req)` от CSRF, выравнивание атрибута `data-dsh-plugin`.
- **2026-09-06**: Устранение замечаний аудита DSH (#107, #108, #109): добавлен `settingsScope` для управления планировщиком, добавлен ключ `noHistory`, локализован пикер моделей.
