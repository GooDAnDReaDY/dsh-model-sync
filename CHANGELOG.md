## 0.2.12 — 2026-08-25

- moved Model Sync from the crowded settings sidebar into a collapsible Plugins settings card with a safe legacy fallback;
- credential diagnostics load on opening the section and no longer report missing providers before the check completes;
- show the full discovered model catalog count instead of the selected allowlist count;
- show enabled/total counts and a `+N` suffix for models added by the latest discovery;
- expand model selection and policy editors directly inside the active provider row;
- rename the policy action to “Manual model selection” / “Ручной выбор моделей”.

## 0.2.10 — 2026-08-25

- polished the Model Sync settings UI into responsive theme-aware cards;
- grouped controls, actions, notifications, credentials, history, and provider editors for clearer scanning;
- kept model discovery, selection, policy, and apply behavior unchanged while improving the visual hierarchy.

## 0.2.9 — 2026-08-25

- added history and diff APIs for comparing synchronization revisions;
- added model lifecycle classification and safe apply/remove handling;
- added credential diagnostics and rotation-reference visibility without exposing secrets;
- added persisted sync reports, bounded deduplicated notifications, and read/ack APIs;
- added a validated declarative provider adapter registry with explicit runtime adapters,
  endpoint/auth/schema diagnostics, and backward-compatible built-ins.

## 0.2.8 — 2026-08-25

- normalized explicit model metadata, capability flags, pricing, and provider tags;
- added bounded timeout/retry/backoff, concurrency limits, and per-provider circuit breakers;
- added read-only provider health probes and a dedicated health API/UI action;
- added persistent include/exclude/capability policies with full-catalog caching;
- added opt-in per-provider scheduling with interval, TTL, jitter, and last/next status.

## 0.2.7 — 2026-08-24

- full discovered model catalogs are cached separately from modelSelections;
- the picker can restore the full last-known catalog after a restart without
  widening the active llm-pi-ai provider catalog;
- dry-run remains read-only and does not persist the cache;
- added regression tests for persistence, restart restoration, and dry-run safety.

# Changelog

## 0.2.6 — 2026-08-24

- frozen snapshots из scope.get() и watcher теперь клонируются перед Schema.resolve;
- устранено падение boot с Cannot assign to read only property при сохранённом выборе моделей.

## 0.2.5 — 2026-08-24

- Settings service привязывается синхронно до создания synchronizer, без окна CONFIG_UNAVAILABLE после старта;
- fallback через ctx.inject сохраняется для позднего подключения провайдера настроек.

## 0.2.4 — 2026-08-24

- base-конфиг настроек клонируется перед регистрацией схемы, чтобы frozen DSH config корректно принимал allowlist;
- устранена ошибка Cannot assign to read only property при первом сохранении выбора моделей.

## 0.2.3 — 2026-08-24

- writer выбора моделей теперь корректно подключается после асинхронной инициализации Cordis Settings;
- сохранение allowlist больше не возвращает CONFIG_UNAVAILABLE в штатном DSH runtime.

## 0.2.2 — 2026-08-24

- подключение namespace настроек переведено на штатный DSH Settings API через ctx.inject(['settings']);
- выбор моделей сохраняется в настройках DSH;
- при ошибке записи каталога allowlist откатывается, чтобы конфигурация не расходилась с каталогом;
- добавлены регрессионные тесты для wiring и атомарности.
