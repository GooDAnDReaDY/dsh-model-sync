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
