# Architecture baseline

## Goal

Keep API-key model catalogs current without changing DSH core or coupling to neighboring plugins.

## Components

1. Provider inventory: reads the DSH configurable-provider directory and current settings metadata.
2. Credential resolver: obtains a one-shot credential through the DSH credentials service.
3. Adapter registry: selects generic OpenAI-compatible discovery or a provider-specific adapter.
4. Reconciliation engine: validates, deduplicates, diffs, and optionally applies model metadata.
5. Scheduler and web API: expose manual/dry-run runs and periodic refresh.
6. Settings UI: displays status, errors, and pending changes without showing secrets.

## Provider inventory rules

The directory supplied by ``ctx.llm.listConfigurableProviders()`` is the source of provider identities. Built-in API-key capability is represented by a versioned allowlist derived from the installed DSH/pi-ai catalog. A configured route with ``apiKeyEnv`` is included even when it is a custom route. OAuth-only, subscription, and tool-only routes are excluded. A provider without a configured key remains visible as dormant and is never probed.

## Model normalization

Adapters return provider, id, name, optional contextWindow, optional maxTokens, and optional description. Unknown rows and duplicate ids are skipped deterministically. The reconciliation layer compares normalized metadata, not wire-specific field names.

## Safety boundaries

- Discovery is read-only by default.
- Applying a catalog requires explicit configuration.
- Updates use settings revision checks.
- Failed providers do not stop other providers.
- Secrets are resolved only for a request and never returned in status or logs.
