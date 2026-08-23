# @goodandready/dsh-model-sync

Automatic model catalog synchronization for API-key providers in DeepSeek Harness.

The plugin is designed for:

- API-key providers already configured in DSH;
- API-key providers available in the built-in DSH catalog but not configured yet;
- future custom API-key provider routes.

OAuth, subscription, and tool-only routes are intentionally outside the scope.

## Status

Runtime, scheduler, HTTP API, reconciliation, and Settings UI are implemented. Release and staging verification remain before publication.

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
