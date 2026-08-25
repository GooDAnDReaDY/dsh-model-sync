# Findings

## Baseline

- `origin/main` = `799523c`, package version `0.2.7`.
- Тестовая база по `index.md`: 33 теста; публикационный артефакт имеет scoped имя.
- Существующий `fix/model-selection-ui` worktree принадлежит старой закрытой задаче; не используется и не удаляется.
- DEV-root checkout не имеет валидного HEAD; это зарегистрировано отдельным issue #36.

## Block split

- `v0.2.8`: normalization, reliability, health, policies, scheduler.
- `v0.2.9`: history, lifecycle, credentials, reporting, adapters.

## Research log

Заполнять после каждого reuse-first поиска и проверки текущего кода.

## #29 reuse-first research

- Existing `lib/models.js` is the canonical normalization boundary and will be extended in place.
- Existing adapter registry already feeds provider-specific rows into that boundary.
- Internal code library search found generic capability/pricing registries but no DSH model-catalog normalizer safe to adopt directly.
- Contract: preserve raw provider/model id; add only explicit metadata; unknown stays absent; do not retain arbitrary raw payload.

## #29 implementation

- Extended `lib/models.js` in place with explicit aliases for context/max tokens, capability flags, and per-token pricing.
- Unknown capabilities and pricing are omitted; no inference by model name.
- Added regression coverage for array capabilities, nested pricing, explicit false, and unknown omission.
- Updated architecture, testing strategy, plan, and root index documentation.

## #31 implementation

- Added `lib/reliability.js` with status classification, timeout signals, bounded retry/backoff, and concurrency mapping.
- Adapter HTTP errors now carry a numeric status for safe transient/permanent classification.
- Synchronizer isolates providers, exposes retry counts, and opens per-provider circuits after repeated transient failures.
- Missing `providers` config now safely means all discovered configured providers, matching the DSH Config default.

## #30 implementation

- Added adapter `health` probes that check HTTP status and cancel response bodies without parsing catalogs.
- Added synchronizer `health()` snapshot, separate POST `/dsh-model-sync/health`, and Settings UI availability action.
- Health uses #31 bounded timeout/retry/concurrency but never writes model catalogs or circuit state.

## #28 research and implementation

- Reused the existing `modelSelections`/full `modelCatalogs` split; no second catalog store was introduced.
- Added normalized bounded provider tags so policies can match provider-supplied labels without guessing from model names.
- Policy semantics are explicit: case-insensitive include/exclude regex against id/name/tags, plus only four known capability keys; absent metadata never satisfies a requirement.
- Policies are persisted per configured provider and applied only by the next explicit run; the full catalog cache remains complete for later picker refinement.
- Invalid regex and oversized inputs fail before settings writes.

## #26 research and implementation

- Reused the existing scheduler lifecycle (`start`, `stop`, `reconfigure`) and the same synchronizer `run` path; no parallel discovery implementation was added.
- Added an opt-in `scheduleEnabled` setting (the plugin itself can remain enabled while background traffic stays off).
- A single minute safety timer drives due-provider checks; per-provider interval, TTL, jitter, enabled flag, and serialized execution are enforced in memory.
- Scheduler status is exposed through the existing status endpoint and Settings UI; errors are isolated per provider.
