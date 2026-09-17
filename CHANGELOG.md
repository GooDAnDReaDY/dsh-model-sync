## 0.4.0 — 2026-09-17

- **One-Click Updater from Settings Card (`lib/updater.js`)**:
  - Direct update check and one-click npm upgrade directly from the DSH settings card.
  - SemVer 2.0.0 and prerelease comparison, loopback/same-origin security checks, and explicit restart requirement notice.
  - Automatic route unregistration on plugin unload via Cordis `ctx.effect`.
- **Write Route Hardening & Security Audit (`lib/security.js`)**:
  - Enforced loopback IP verification (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) and valid host origin on all mutating HTTP endpoints.
  - Eliminated silent empty catch blocks with structured debug-level diagnostic logging.
- **Explicit Client Injections**:
  - Declared required DSH client service modules in `package.json` (`dsh.client.inject`: `@deepseek-ai/dsh-client-locale`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-settings`).
- **100% Design Token Compliance**:
  - Replaced all hardcoded `rgba()` styling in `lib/client.js` with official CSS design tokens (`--dsw-alias-state-*`, `--dsw-alias-bg-*`, `--dsw-alias-border-*`).
- **Modular Synchronizer Decomposition**:
  - Decomposed monolithic synchronizer into dedicated focused modules (`lib/synchronizer-helpers.js`, `lib/synchronizer-transfer.js`, `lib/synchronizer-prober.js`), keeping `synchronizer.js` well below the 600-line guideline.
- **Clean Distribution Bundle**:
  - Removed internal planning artifacts and legacy test tarballs; verified package size < 70 KiB packed, with no files exceeding 256 KiB.

## 0.3.11 — 2026-09-10

- removed top-level sidebar fallback (`settings.section`) to keep UI clean and consistent with DSH standards (Settings → Plugins → Plugin Settings);
- safe Cordis service access via `ctx.get(...)` with fallback to direct proxy access (`ctx.settings`, `ctx.llm`) to prevent silent failures on core variants;
- updated design contract and documentation.

## 0.3.10 — 2026-09-08

- deduplicated UI polling between active settings card and section view;
- paused UI polling when browser tab is hidden (`document.hidden`);
- added fast catalog diff comparison shortcut in synchronization engine;
- pruned unused helper functions and refined repository `.gitignore`.

## 0.2.14 — 2026-08-25

- dry-run now renders an explicit per-provider diff preview with a separate apply action;
- the model picker can filter the current catalog by normalized capabilities without changing the saved allowlist until it is explicitly applied.
- the settings card now follows the shared DSH card geometry and theme tokens (12px radius, 14px/16px header spacing, 15px title, and bordered body).

## 0.2.13 — 2026-08-25

- matched the DSH settings-card pattern: native list item structure, standard show/hide labels, and the same SVG chevron behavior;
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

## 0.3.0 - 2026-08-26

- Model info convenience: tags/description, docs link, diff preview, firstSeen/lifecycle/NEW, search/filter/sort, auto-source truth, notifications, cached fallback (#74-86)

## 0.3.1 - 2026-08-27

- feat: 0.3.1 model info extras (#89-96)
  - badge +N on card header
  - per-provider autoApply
  - prices in/cache/out
  - try button per model
  - flagship/cheapest tags, health latency, offline cache
