# Testing strategy

## Unit

- provider classification
- adapter selection
- model normalization and deduplication
- diff/reconciliation behavior
- credential redaction

## Integration

- mocked OpenAI-compatible endpoint
- mocked provider-specific endpoint
- settings revision conflict
- scheduler cancellation and retry

## Staging

Install the package as a bundle in the staging DSH profile, run manual dry-run and apply flows, verify the Settings UI, then test the npm-installed artifact before release.
