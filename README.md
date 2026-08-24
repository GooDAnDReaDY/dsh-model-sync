# @goodandready/dsh-model-sync

Automatic model catalog synchronization for API-key providers in DeepSeek Harness.

The plugin is designed for:

- API-key providers already configured in DSH;
- API-key providers available in the built-in DSH catalog but not configured yet;
- future custom API-key provider routes.

OAuth, subscription, and tool-only routes are intentionally outside the scope.

## Status

Runtime, scheduler, HTTP API, reconciliation, model allowlists, and Settings UI are implemented. The release workflow includes staging and production verification before publication.

## Development

See the project documentation under ``docs/`` for architecture, research, testing, and release notes.

## API and safety

`GET /dsh-model-sync/status` reports provider state without secrets.

`POST /dsh-model-sync/run` defaults to a read-only dry-run:

```json
{ "provider": "openai", "dryRun": true }
```

Apply is explicit:

```json
{ "provider": "openai", "dryRun": false, "removeMissing": false }
```

Omit `provider` to discover all enabled API-key providers in one run. The Settings UI exposes this as **Refresh all**.

`POST /dsh-model-sync/selection` stores and applies a per-provider model allowlist:

```json
{ "provider": "openai", "models": ["gpt-5", "gpt-5-mini"] }
```

An empty `models` array means all models in the latest available catalog. The selected catalog is written to DSH's `llm-pi-ai` settings, so the standard DSH model picker refreshes from the resulting list.
