# Architecture baseline

## Goal

Keep API-key model catalogs current without changing DSH core or coupling to neighboring plugins.

## Components

1. Provider inventory: reads the DSH configurable-provider directory and current settings metadata.
2. Provider service: exposes a live inventory through the DSH context without making network requests.
3. Credential resolver: obtains a one-shot credential through the DSH credentials service.
4. Adapter registry: selects generic OpenAI-compatible discovery or a provider-specific adapter and exposes a lightweight health probe.
5. Reconciliation engine: validates, deduplicates, diffs, and optionally applies model metadata.
6. Reliability layer: applies per-provider timeout, retry/backoff, concurrency limits, and transient-failure circuit breakers.
7. Scheduler and web API: expose manual/dry-run runs and periodic refresh.
8. Scheduler policy: keeps scheduling opt-in, supports per-provider cadence, TTL, jitter, and observable last/next timestamps.
9. Catalog cache: stores the last successful applied discovery separately from the active allowlist.
10. Model policy engine: filters cached and discovered catalogs by bounded patterns, tags, and explicit capabilities.
11. Settings UI: displays status, errors, and pending changes without showing secrets.

## Provider inventory rules

The directory supplied by `ctx.llm.listConfigurableProviders()` is the source of provider identities. Built-in API-key capability is represented by a versioned allowlist derived from the installed DSH/pi-ai catalog. A configured route with `apiKeyEnv` is included even when it is a custom route. OAuth-only, subscription, and tool-only routes are excluded. A provider without a configured key remains visible as dormant and is never probed.

## Model normalization

Adapters return provider, id, name, and optional normalized metadata. The common
normalizer accepts explicit aliases for context window and output limits, plus
capability flags (`vision`, `tools`, `reasoning`, `embeddings`) and pricing
(`inputPerToken`, `outputPerToken`, optional currency/unit), and bounded provider tags. Unknown values stay
absent: the plugin never infers a capability from a model name or arbitrary raw
payload. Unknown rows and duplicate ids are skipped deterministically. The
reconciliation layer compares normalized metadata, not wire-specific field names.

## Reliability policy

Discovery runs are isolated per provider. Transient HTTP statuses (408, 425,
429, 5xx) and transport/timeouts use bounded exponential backoff; permanent
credential or schema failures are not retried. A concurrency limit prevents a
mass refresh from flooding providers. A per-provider circuit opens after the
configured number of transient failures and reports `circuit-open` without
rewriting the catalog; the cooldown is bounded and configurable. All request
signals are cleaned up when the Cordis operation ends.

## Scheduler

Scheduling is opt-in through `scheduleEnabled`; the plugin and its manual API remain
usable when it is off. A single guarded timer polls due providers, while each
configured provider may override the global interval and set a minimum TTL and
jitter. Runs are serialized and use the same synchronizer path as manual requests;
a failed provider is recorded and does not cancel the other providers. Status
exposes scheduler activity plus last/next timestamps for the UI.

## Runtime service

The plugin provides `modelSync` through the DSH context. Its inventory methods re-read the provider directory and settings on every call, so adding a route or key does not require a plugin restart.

## Adapter registry

The registry first selects the generic OpenAI-compatible adapter for routes with a configured `baseURL` and supported protocol. For built-in API-key providers without a route `baseURL`, it uses provider descriptors with documented default endpoints and auth styles (Bearer, `x-api-key`, or query key). Unsupported protocols are reported explicitly instead of guessed.

## Credentials boundary

Keys are resolved only through the DSH credentials service, trimmed and checked for printable header-safe characters, then discarded after the request. Error messages contain only the credential reference and never the key value. The plugin does not read environment variables directly.

## Reconciliation policy

Every discovery returns a normalized advertised list. Existing model ids are updated in place and new ids are appended. Models missing from an advertised response remain in the catalog by default and are always reported as stale; pruning requires an explicit option. Settings patches replace only the selected provider profile and preserve credentials, transport, and retry fields.

## Generic endpoint adapter

For profiles with `baseURL` and `openai-completions` or `openai-responses`, the generic adapter requests `GET <baseURL>/models` with a short-lived bearer key. It enforces a response-size limit, validates JSON, normalizes common metadata aliases, and never returns the credential.

## Safety boundaries

- Discovery is read-only by default.
- Applying a catalog requires explicit configuration.
- Updates use settings revision checks.
- Failed providers do not stop other providers.
- Secrets are resolved only for a request and never returned in status or logs.

## Runtime HTTP contract

The plugin exposes `GET /dsh-model-sync/status`, `POST /dsh-model-sync/run`, `POST /dsh-model-sync/health`, `POST /dsh-model-sync/selection`, `POST /dsh-model-sync/policy`, `GET /dsh-model-sync/history`, and `POST /dsh-model-sync/history/rollback`. The run payload is validated as `{ provider?, dryRun?, removeMissing? }` and defaults to a read-only dry-run; health accepts only an optional provider and never writes settings. Selection writes a bounded per-provider allowlist, while policy writes bounded include/exclude patterns and explicit capability requirements. Applying changes uses the current `llm-pi-ai` settings revision, so concurrent edits fail safely instead of being overwritten. Applied runs append bounded history snapshots with deterministic added/removed/renamed/metadata-changed diffs; rollback writes only the selected provider catalog and leaves model selections untouched.

Reconciliation is additive by default: new models and metadata are applied, while models absent from one response are retained and reported as stale. Pruning requires an explicit `removeMissing: true` request.


## Selection policies

`modelPolicies` is persisted per configured API-key provider. Include and exclude
patterns are case-insensitive regular expressions matched against normalized model
id, name, and provider-supplied tags. Policies may require or deny only explicit
capabilities (`vision`, `tools`, `reasoning`, `embeddings`); missing metadata never
counts as a capability. Patterns and capability maps are bounded and invalid
regular expressions are rejected before settings are written. A policy affects the
next explicit apply run; the full discovered catalog remains cached separately so
the picker can be refined without another network request.


## Catalog cache and allowlist

modelSelections is the explicit per-provider allowlist applied to llm-pi-ai.
modelCatalogs is a separate plugin-owned cache of the full normalized catalog from
the last successful non-dry-run discovery. A restart therefore does not make the
model chooser collapse to the selected subset. Dry-run never writes either the
active DSH catalog or this cache. A cache write failure is reported in the run
result after a successful revision-checked DSH update and does not roll that update
back.
