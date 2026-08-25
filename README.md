# @goodandready/dsh-model-sync

Automatic model catalog synchronization for API-key providers in DeepSeek Harness.

The plugin is designed for:

- API-key providers already configured in DSH;
- API-key providers available in the built-in DSH catalog but not configured yet;
- future custom API-key provider routes.

OAuth, subscription, and tool-only routes are intentionally outside the scope.

## Status

Runtime, scheduler, HTTP API, reconciliation, model allowlists, and Settings UI are implemented. The release workflow includes staging and production verification before publication.

The Settings UI groups synchronization controls, run summaries, configured providers, diagnostics, notifications, history, and editors into responsive cards that follow the DSH theme.
Each configured provider row shows `enabled/total` model counts and a temporary `+N` discovery suffix for newly found models; the manual model-selection and policy editors expand directly below that row.

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

A dry-run renders a per-provider diff preview (added, removed, and metadata-changed models). Use the explicit **Apply preview** action to write the catalog; stale-model removal still requires its confirmation.

The model picker exposes a capability filter based only on explicit normalized metadata (`vision`, `tools`, `reasoning`, and `embeddings`). Multiple selected capabilities use an all-of match, and filtering does not discard hidden selections.


The plugin-owned `adapterRegistry` setting adds an opt-in declarative adapter without copying code. A provider entry can specify `endpoint`, `auth` (`bearer`, `x-api-key`, `query-key`, or `none`), `parser`, `modelsPath`, field paths, and explicit capability mappings. Endpoints must be HTTPS except loopback HTTP; credential-like static headers and URL query/fragment data are rejected. Existing built-in descriptors and OpenAI-compatible routes remain the default. Runtime integrations can register an explicit adapter implementation through the registry escape hatch, provided it implements `discover` and `health`.

The full catalog discovered by an applied run is cached in the plugin's own settings
separately from the model allowlist. After a restart, the model chooser can show the
full last-known catalog while the standard DSH picker still exposes only the selected
models. Dry-run remains read-only and does not persist this cache.


`GET /dsh-model-sync/report` returns the latest stable aggregate report. It distinguishes success, partial success, failure, and empty runs, includes provider/model counts, and labels whether the source was manual or scheduled. `GET /dsh-model-sync/notifications` returns the bounded in-app notification ledger; repeated identical failures update an occurrence counter instead of creating noise. `POST /dsh-model-sync/notifications/read` and `POST /dsh-model-sync/notifications/acknowledge` accept `{ "id": "sync-notice-..." }` and persist the corresponding state for applied runs. Report and notification text is redacted before it leaves the synchronizer; no webhook or MCP dependency is required.

`GET /dsh-model-sync/credentials` returns bounded diagnostics for configured provider credential references. It calls the DSH credentials `describe` seam only, reports masked reference labels, source/configured state, rotation order, and the last safe request outcome. It never resolves or returns a credential value. `POST /dsh-model-sync/credentials/check` runs the health probe and returns the same diagnostics in one response; a failed reference is recorded per provider without hiding the remaining rotation entries.

`GET /dsh-model-sync/history` returns the bounded history of applied runs. Use
`?provider=<id>&details=true` for one provider's full snapshots and metadata diff.
`POST /dsh-model-sync/history/rollback` accepts `{ "historyId": "sync-…", "provider": "openai" }`
and restores only that provider's catalog; it never changes the model allowlist.
History is written only by non-dry-run synchronization, is retained according to
`historyLimit` (1–200, default 50), and redacts credential-shaped error values.
Rename detection requires an explicit provider `aliases` or `previousIds` field;
model-id similarity is never guessed.


Lifecycle protection keeps a model `stale` after a missing discovery and only
moves it to `removed` after the configured `staleGraceRuns` and an explicit
removal confirmation. Provider-declared `deprecated`/`deprecationDate`/
`expiration_date` metadata is retained as an audit status. Repeated transport or
credential failures do not advance lifecycle counters. The full catalog cache
retains stale entries until the user confirms removal; the model picker defaults
to active models while explicit selections may still name a retained model.
