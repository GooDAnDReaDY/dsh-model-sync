## 0.5.10 — 2026-10-08

### Security
- **ReDoS Protection in Model Policy (#202, PR #252)**:
  - Extended `isDangerousPattern` regex guard to block overlapping alternations (e.g. `^(a|aa)+$`, `(a|b)+`, `(a|aa){2,}`) and quantified alternation groups, preventing catastrophic backtracking during model filtering.
- **Fail-Closed Webhook Signing (#204, PR #252)**:
  - Enhanced `dispatchDiffNotifications` to fail closed if `diffWebhookSecretRef` is configured but fails to resolve via DSH credentials service, preventing unsigned webhook dispatch.
  - Added support for `diffWebhookSecretRef` with `role('credential-ref')`.
- **SSRF Hardening for Webhook URL Guard (#205, PR #252)**:
  - Expanded webhook URL validator to reject IPv4-mapped metadata (`[::ffff:169.254.169.254]`, `[::ffff:a9fe:a9fe]`), cloud metadata DNS names (`instance-data`, `metadata.google.internal`, `metadata`), Alibaba metadata (`100.100.100.200`), and IPv6 link-local addresses (`fe80::/10`).
  - Restricted insecure HTTP webhook URLs strictly to verified loopback addresses.
- **Core Authentication Enforcement on Updater and API Routes (#237, PR #252)**:
  - Integrated `ctx.connection.requestRejection(req)` in plugin updater and HTTP API route handlers, rejecting unauthorized requests before plugin processing.
  - Implemented strict numeric IPv4 loopback parser in `isLoopback`, rejecting external DNS hostnames matching `127.*` (e.g., `127.attacker.example`).
- **Authorization Header and Token Sanitization (#238, PR #252)**:
  - Exported unified `sanitizeSecretString` across credentials resolver, history, reporting, and synchronizer helpers.
  - Fully redacts `Authorization: Bearer <token>`, `Basic <token>`, standalone Bearer tokens, and URL query parameter keys (`token=...`, `key=...`, `api_key=...`), preventing secret tokens from leaking into error messages, history snapshots, or diagnostic endpoints.

## 0.5.9 — 2026-10-08

### Fixed
- **Volatile Schema Fields for DSH Settings (#186, PR #250)**:
  - Added `.volatile()` declaration to `notifications`, `modelLifecycle`, `history`, `providers`, `aliases`, `adapterRegistry`, `modelPolicies`, and `modelCatalogs` in `Config` schema, allowing DSH 0.2.0-rc.2 `SettingsForms` to persist all plugin configuration sections without rejection.
- **Persistence Error Propagation (#227, PR #250)**:
  - `saveConfig` now checks `settings` service availability and rethrows underlying write errors instead of catching them silently, preventing unsaved state from masquerading as saved in `liveConfig`.
- **Temporal Dead Zone on Startup Config (#228, PR #250)**:
  - Initialized `liveConfig` declaration before `resolveConfig` execution in `apply()`, eliminating `ReferenceError: Cannot access 'liveConfig' before initialization` when initial config validation fails.
- **Active Model Policy & Selection Exclusion (#229, PR #250)**:
  - Filtered models excluded by user policy or model selections are now explicitly included in removal targets during reconciliation, ensuring denied models are removed from active DSH provider catalogs upon Apply.
- **Runtime Body Cache for HTTP 304 (#230, PR #250)**:
  - Cached discovered models alongside HTTP metadata in runtime memory, allowing subsequent 304 Not Modified responses during dry-runs to retain full model definitions before catalog disk persistence.
- **HTTP 200 Error Payload Detection (#231, PR #250)**:
  - Both `generic-adapter` and `adapter-registry` now detect error payloads (`error` or `errors` fields) and malformed non-array payloads in HTTP 200 responses and throw schema errors instead of treating them as empty model catalogs, preventing accidental catalog purging.
- **Full Model Contract Preservation on Rollback (#232, PR #250)**:
  - `cloneModel` in history now preserves `input`, `compat`, `tags`, `aliases`, and `lifecycle` metadata, preventing rollback snapshots from dropping multimodal and developer role settings.
- **Reference Pricing Source Preservation (#235, PR #250)**:
  - `normalizePricing` now preserves `source: row.pricing.source` across repeated model normalizations.

## 0.5.8 — 2026-10-06

### Fixed
- **Streaming Response Memory Bound (#210, PR #225)**:
  - Replaced post-buffering size check with `readBoundedText` streaming chunk counter; chunked response bodies exceeding 4 MB are cancelled immediately without materializing excessive payload in memory.
- **Vision Heuristic Alignment (#211, PR #225)**:
  - Removed dead outer regex tokens (`multimodal|4v|4o|flash`) in model normalization, ensuring vision capabilities are strictly and reliably assigned for `vision` and `vl` tagged models.
- **Config Import Model Array Boundary (#212, PR #225)**:
  - Sanitized, deduplicated, trimmed, and capped `selectedModels` arrays in `importConfig` at 1000 items, matching single-provider selection constraints and preventing unbounded memory growth.
- **Code Cleanup and Unused Parameters (#213, PR #225)**:
  - Removed unreachable `throw lastError` and unused variable in `retryWithBackoff`.
  - Reorganized module imports cleanly at file top in `http.js` and deleted redundant `sec-fetch-mode` condition.
  - Removed unused `provider` argument from `modelScoreForCode` in `alias-resolver.js`.
- **Service Peer Dependencies Declaration (#216, PR #225)**:
  - Declared missing runtime service peer dependencies in `package.json`: `@deepseek-ai/dsh-credentials`, `@deepseek-ai/dsh-host-webserver`, and `@deepseek-ai/dsh-settings` (`^0.1.7-rc.2 || ^0.2.0-rc.1`).
- **Canonical UI Theme Tokens (#217, PR #225)**:
  - Replaced 5 non-existent theme token names in client bundle (`border-primary`, `state-brand-primary`, `state-success`, `state-warning-primary`, `state-warning-secondary`) with canonical DSH design tokens (`--dsw-alias-border-l2`, `--dsw-alias-brand-primary`, `--dsw-alias-state-success-primary`, `--dsw-alias-state-warn-primary`, `--dsw-alias-state-warn-secondary`).

## 0.5.7 — 2026-10-06

### Fixed
- **Model Probing & Catalog Validation (#195, PR #223)**:
  - tryModel and batchTryModels now validate models against provider catalogs, returning model_not_found for missing models instead of blindly reporting success.
  - batchTryModels batches the provider health check into a single check per batch rather than executing redundant checks per model.
- **Price-Change Detector Comparison Logic (#198, PR #223)**:
  - Fixed inverted price comparison that checked before-input against after-output; prices now properly compare before-input with after-input, and before-output with after-output.
- **Accurate Latency in Smart Alias Resolution (#199, PR #223)**:
  - @fast resolution now uses real measured probe latencies from modelProbes when available, and explicitly marks estimated latency fallbacks without fabricated lowest_latency claims.
- **Virtual Alias Classification (#200, PR #223)**:
  - isVirtualAlias restricts virtual status to explicitly configured virtual strategies and built-in aliases (@fast, @cheap, @best-code), avoiding false virtual flags on arbitrary @-prefixed names.
- **Non-Exclusionary Capability Filtering (#201, PR #223)**:
  - Capability filters treat expected: false as "do not require", preventing models lacking explicit capability declarations from being purged from the catalog.
- **ReDoS Protection in Policy Regexes (#202, PR #223)**:
  - Added complexity detector for catastrophic backtracking patterns (nested quantifiers, repeated wildcards) in user-supplied include/exclude regular expressions.
- **Anchored Reference Pricing Lookups (#203, PR #223)**:
  - Replaced unanchored prefix matching with exact and date-cleaned matches, eliminating erroneous price inheritance for derived model names and cross-provider pricing leaks.
- **Occurrence Counter Saturation (#208, PR #223)**:
  - Fixed notification occurrence increment order so counters properly cap at 1,000,000 instead of overflowing to 1,000,001.
- **Side-Effect Free Scheduler Status (#209, PR #223)**:
  - Removed state mutation (resetStates) from the read-only status() query, ensuring monitoring calls do not prematurely trigger scheduled jobs.

## 0.5.6 — 2026-10-06

### Security
- **Built-in Provider Endpoint Host Pinning (#194, PR #221)**:
  - Guard against API key exfiltration when custom endpoints are configured. Custom endpoint hostnames for standard providers must match official provider domains, resolve to loopback, or be explicitly authorized via allowCustomHost: true.
- **Credential Storage for Webhook Secrets (#204, PR #221)**:
  - Added diffWebhookSecretRef marked with .role('credential-ref'). Stored secrets are resolved securely at runtime via ctx.credentials.resolve().
- **SSRF Hardening for Webhook Test and Dispatch (#205, PR #221)**:
  - Validated webhook URLs: restricted plain HTTP strictly to loopback addresses, blocked cloud metadata endpoints (169.254.169.254, metadata.google.internal), link-local IPs, and wildcard 0.0.0.0.
- **Supply-Chain Guard Preservation in Updater (#214, #215, PR #221)**:
  - Removed --config.minimumReleaseAge=0 argument when invoking pnpm for exact package installations, ensuring package registry release-age guards remain enforced.
- **LAN Isolation for Sensitive Read Routes (#218, PR #221)**:
  - Restricted /export, /credentials, /history, and /aliases GET routes to loopback connections (127.0.0.1, ::1). Only unauthenticated read status (/status) remains reachable from the local network.

## 0.5.5 — 2026-10-06

### Fixed
- **Host Settings Service Contract (#193, PR #219)**:
  - Replaced non-existent `settings.get(ns)` calls with `sectionOf(settings, ns)` using host `settings.describe()` across synchronizer-helpers, inventory, and model selection.
- **ClineBot Dedicated Model Parser Routing (#197, PR #219)**:
  - Aligned provider descriptor to `parse: 'clinebot-plan'` and enhanced `parseRows` to check both `parse` and `parser`.
- **Accurate Error Propagation in Fetch (#196, PR #219)**:
  - Removed catch block error swallowing in `fetchSpecific`; network, authentication, and HTTP failures now propagate rather than returning fabricated `defaultModels` with status ok.
- **Runtime Plugin Activation (#206, PR #219)**:
  - Unconditionally registered `modelSync` and `modelSyncRunner` services at plugin start so toggling `enabled` at runtime immediately enables syncing without host restart.
- **Volatile Config Error Safety & Listener Disposal (#207, PR #219)**:
  - Added try/catch fallback in `resolveConfig` and wrapped `loader/volatile-update` listener in `ctx.effect` for clean disposal.
- **Web UI Smart Alias Testing (PR #219)**:
  - Implemented `resolveSmartAlias` in settings card to eliminate `ReferenceError` when testing preset aliases.

## 0.5.4 — 2026-09-30

### Fixed
- **Unwrap Cordis Volatile Config Wrappers on Activation (#186, PR #189)**:
  - Fixed `DOMException [DataCloneError]: () => true could not be cloned` when activating on DSH 0.2.0-rc.2.
  - `apply(ctx, config)` now unwraps live Volatile boxes via `plainConfig(config || {})` before `structuredClone`.
  - `resolveConfig` unwraps Schemastery return values to ensure `liveConfig` consists exclusively of plain JavaScript primitives, arrays, and objects.
  - Restored core service, synchronizer, and scheduler instantiations accidentally omitted during earlier refactoring.
  - Connected `saveConfigImpl` to `ctx.settings.update('dsh-model-sync', plainPatch)` with resilient fallback.
  - Subscribed to Cordis `loader/volatile-update` event on `ctx` for real-time config updates without restart.
  - Added defensive guard in `registerHttpApi` when `ctx.webServer` is absent.
  - Added regression test suite verifying Volatile unwrapping and settings updates.

## 0.5.3 — 2026-09-29

### Fixed
- **DSH 0.2.0 Settings Form Contract (#186, PR #188)**:
  - Marked user-facing schema fields as `.volatile()` so DSH registers and serves the configuration form.
  - Aligned namespace to profile entry id (`dsh-model-sync`).

## 0.5.1 — 2026-09-27

### Fixed
- **Virtual Aliases Validation & Strategy Enforcement (#174, #176)**:
  - Enforced strict strategy validation against supported `VIRTUAL_STRATEGIES` (`fastest`, `cheapest`, `best-code`), rejecting unsupported values with `INVALID_STRATEGY`.
  - Wired `isVirtualAlias()` into alias routing and normalization, eliminating dead exports and runtime ambiguity.
  - Added support for virtual alias names, fallback targets (`targets: string[]`), and strategies in HTTP `POST /aliases` request normalization.
- **HTTP Aliases Route Method Guard (#175)**:
  - Added strict method guard returning 405 Method Not Allowed on non-GET requests to `/aliases/resolve`, preventing unintended pass-through to synchronization runs.

### Refactored
- **Core Synchronizer Modularity (#177)**:
  - Streamlined `lib/synchronizer.js` to 559 lines (below the 600-line modularity threshold) by delegating `refsFor` and `performHistoryRollback` to `synchronizer-helpers.js`.
  - Consolidated sub-facade exports for prober and config transfer.
  - Fixed unquoted webhook test event name in synchronizer facade.

### Style & UI
- **Native DSH Chevron Icon Integration (#178)**:
  - Integrated DSH core `IconChevronDownOutline14` from `@deepseek-ai/dsh-client-ui-primitives` for settings card accordion with seamless SVG fallback.

## 0.5.0 — 2026-09-27

### Added
- **External Diff Webhooks & Event Dispatch (#166, PR #167)**:
  - Added outbound HTTP POST webhook dispatch and Cordis event dispatch for model lifecycle updates (`model.added`, `model.deprecated`, `model.removed`, `price.changed`).
  - Added optional HMAC-SHA256 signature verification headers (`x-hub-signature-256`, `x-signature`).
  - Integrated with `dsh-plugin-notify` service when available for in-system notifications.
  - Added webhook test route `POST /api/dsh-model-sync/webhook/test` and interactive test trigger in Settings UI.
- **Smart Virtual Aliases & Auto-Fallback Chains (#168, PR #169)**:
  - Added dynamic model aliases with `@` prefix (`@fast`, `@cheap`, `@best-code`) and target fallback chains (`targets: string[]`).
  - Implemented health and circuit breaker awareness: automatically skips unhealthy models and providers with open circuits during fallback resolution.
  - Added strategies for lowest latency (`fastest`), lowest token cost (`cheapest`), and code/reasoning capability ranking (`best-code`).
  - Exposed resolution endpoint `GET /api/dsh-model-sync/aliases/resolve` and programmatic API `synchronizer.resolveAlias()`.
  - Added live alias resolution preview and tester in Settings card.
- **Reference Pricing Database Enrichment (#170, PR #171)**:
  - Added canonical per-token rate reference database for providers without pricing metadata in `/models` (OpenAI, Anthropic, Groq, Mistral, xAI, DeepSeek, Google).
  - Automatically enriches model catalog during normalization with `pricing.source = 'reference'`.
  - Enables cost filtering (`maxPricePerMillion`) and `@cheap` alias resolution across major API-key providers.

## 0.4.9 — 2026-09-27

### Fixed
- **Command Code Catalog Restoration (#162)**: `setModelSelection` for `commandcode` now correctly restores all available catalog models into `visibleModels` when the selection is cleared (`selectedModels: []`), avoiding unintended hiding of all models.
- **Resilient Slot Registration (#163)**: Wrapped UI slot registrations in `lib/client.js` with a fallback to `ctx.slots.register` when `ctx.slots.inject` is unavailable, ensuring cards render across all DSH core builds.

### Documentation
- **Design Contract Tracking (#164)**: Updated `docs/design/DESIGN.md` release status to track current features and added contract sections 6.23 and 6.24.

## 0.4.8 — 2026-09-25

### Fixed
- **Locale Registration Disposer (#160)**: `apply()` in `lib/client.js` now returns the idempotent disposer returned by `ctx.locale.register()`, properly unregistering dictionary namespaces during plugin unload/HMR and preventing stale dictionary reuse or name collisions on subsequent `apply()`.

## 0.4.7 — 2026-09-24

### Performance & Reliability
- **Policy Filter Fast-Path (#153)**: Added early return in `filterModels` when no active policy rules (include/exclude patterns, capability constraints, pricing or context limits) are defined, eliminating regex compilation and array iteration during default discovery runs.
- **Updater Cache Bypass on Fresh Check (#154)**: Integrated `resetLatestCache()` into `registerPluginUpdater` GET/HEAD routes triggered by `fresh=1` query parameter or `Cache-Control: no-cache` header. UI update checks now reliably fetch the latest npm registry version without waiting for the 10-minute cache TTL.
- **Package Assets Completeness**: Explicitly included localized `README.zh.md` and `README.ru.md` in npm package manifest.

## 0.4.5 — 2026-09-20

- **Adapter Selection Precedence**: Fixed adapter selection in registry so built-in provider adapters take precedence over generic OpenAI-compatible adapter when a default `baseURL` is present in the profile, ensuring Command Code uses its dedicated catalog endpoint rather than falling back to 404.

## 0.4.6

### Fixed
- Settings no longer wait on the removed settingsScope service. The client uses configForms (#155).

## 0.4.4 — 2026-09-20

- **Command Code Model Management (#151)**: Added `commandcode` provider support with live catalog discovery from `https://api.commandcode.ai/provider/v1/models` (71 models), model allowlist management (`modelSelections.commandcode`), and automatic synchronization to `llm-commandcode.visibleModels`.
- **ClineBot Subscription Plan Adapter (#151)**: Added dedicated `clinebot` provider adapter in `PROVIDER_ADAPTERS` querying `/users/me/plan` with bearer key and parsing `features.included` to expose only the 11 active ClinePass subscription models, preventing generic discovery from querying `/models` which leaked 446 OpenRouter models.

## 0.4.3 — 2026-09-19

- **Settings reachable again on the plugin's own page**: the current core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item` — that is how `dsh-agentrouter` and
  `dsh-agent-orchestrator` show their settings, while the row seat and the legacy card
  alone leave the page without the form. The view-aware card is now registered there
  too (`id: 'dsh-model-sync'`, order 60, static label); both older seats stay as
  fallbacks.

## 0.4.2 — 2026-09-19

- **Settings reachable again**: the card registered into `settings.plugin.item`, a
  slot the current DSH core (0.1.6-alpha.2) no longer renders, so the plugin's
  settings were unreachable. The surface now registers into the Plugins page row
  seat `plugins.row.config`, keyed `@goodandready/dsh-model-sync#dsh-model-sync`
  (`rowConfigKey(package, rowId)`): the plugin's row gains a configure control whose
  page is the settings form (`view: 'page'`, open and without our card chrome — the
  host page draws the title, icon, crumb and padding) plus a one-line state for
  `view: 'summary'`. The legacy seat stays registered as a fallback for older cores.

## 0.4.1 — 2026-09-18

- **Groq & Minijinja Template Compatibility**:
  - Automatically configured `compat.supportsDeveloperRole: false` for open-source model families on Groq (`qwen/*`, `meta-llama/*`, `llama/*`, `mistral/*`, `mixtral/*`, `gemma/*`, `deepseek/*`) as well as the native `deepseek` provider.
  - Resolves upstream HTTP 400 `failed to template request: minijinja: rendering failed: raise_exception: Unexpected message role` when `@earendil-works/pi-ai` invokes reasoning-capable models.
  - Preserves explicit user overrides in `settings.yaml` (e.g. custom `chatTemplateKwargs` or manual role preferences).
- **Catalog Feature & Modality Mapping**:
  - Parsed `supported_features` (`tools`, `reasoning`) from Groq `/openai/v1/models` catalog into `capabilities.tools: true` and `capabilities.reasoning: true`.
  - Mapped `input_modalities: ["text", "image"]` into model `input: ['text', 'image']`.
- **Non-Destructive Reconcile Merging**:
  - Enhanced `reconcileModels` with deep merging for `capabilities`, `compat`, and `input`, ensuring existing manual model settings and customizations are never overwritten during catalog sync.

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
