# Architecture baseline

## Goal

Keep API-key model catalogs current without changing DSH core or coupling to neighboring plugins.

## Components

1. Provider inventory: reads the DSH configurable-provider directory and current settings metadata.
2. Provider service: exposes a live inventory through the DSH context without making network requests.
3. Credential resolver: obtains a one-shot credential through the DSH credentials service.
4. Adapter registry: selects generic OpenAI-compatible discovery or a provider-specific adapter.
5. Reconciliation engine: validates, deduplicates, diffs, and optionally applies model metadata.
6. Scheduler and web API: expose manual/dry-run runs and periodic refresh.
7. Settings UI: displays status, errors, and pending changes without showing secrets.

## Provider inventory rules

The directory supplied by `ctx.llm.listConfigurableProviders()` is the source of provider identities. Built-in API-key capability is represented by a versioned allowlist derived from the installed DSH/pi-ai catalog. A configured route with `apiKeyEnv` is included even when it is a custom route. OAuth-only, subscription, and tool-only routes are excluded. A provider without a configured key remains visible as dormant and is never probed.

## Model normalization

Adapters return provider, id, name, optional contextWindow, optional maxTokens, and optional description. Unknown rows and duplicate ids are skipped deterministically. The reconciliation layer compares normalized metadata, not wire-specific field names.

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

The plugin exposes `GET /dsh-model-sync/status` and `POST /dsh-model-sync/run`. The POST payload is validated as `{ provider?, dryRun?, removeMissing? }` and defaults to a read-only dry-run. Applying changes uses the current `llm-pi-ai` settings revision, so concurrent edits fail safely instead of being overwritten.

Reconciliation is additive by default: new models and metadata are applied, while models absent from one response are retained and reported as stale. Pruning requires an explicit `removeMissing: true` request.
