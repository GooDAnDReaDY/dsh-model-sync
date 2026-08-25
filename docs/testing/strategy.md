# Testing strategy

## Unit

- provider classification
- adapter selection
- model normalization, capability aliases, pricing aliases, and deduplication
- diff/reconciliation behavior
- credential redaction

## Integration

- mocked OpenAI-compatible endpoint
- mocked provider-specific endpoint
- settings revision conflict
- scheduler cancellation and retry
- full catalog cache persistence and restart restoration
- dry-run remains free of plugin-settings writes

## Static checks

Run `node --check` for every runtime module before committing. The pre-commit hook performs static checks but does not replace `npm test`.

## Staging

Install the package as a bundle in the staging DSH profile, run manual dry-run and apply flows, verify the Settings UI, restart once after the full flow, confirm the picker still sees the cached full catalog while the active catalog stays allowlisted, then test the npm-installed artifact before release.

## Workflow gate

Every commit must run `npm test` explicitly and record the result in the issue or PR.
