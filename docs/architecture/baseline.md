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

## Safety boundaries

- Discovery is read-only by default.
- Applying a catalog requires explicit configuration.
- Updates use settings revision checks.
- Failed providers do not stop other providers.
