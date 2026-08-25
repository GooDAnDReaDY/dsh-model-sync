# Findings

## Current API contract

- POST /dsh-model-sync/run defaults to dryRun: true.
- A run result already contains per-provider diff, discoveredModels, availableModels, advertised, and applied.
- POST /dsh-model-sync/run returns the run result plus providers.
- lib/models.js normalizes capabilities to vision, tools, reasoning, and embeddings only when explicitly supplied by adapters.
- The model picker currently uses availableModels and renders every choice without filtering.

## Scope

- Issue #67: make the existing dry-run diff visible and actionable from the UI.
- Issue #68: add capability filtering to the existing model picker without changing policy semantics.
