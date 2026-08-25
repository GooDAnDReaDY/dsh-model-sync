# Findings

- Block 1 is released as v0.2.8 on Gitea main (`641147d`, tag `v0.2.8`).
- RELEASE was fast-forwarded from Gitea main and reports package version 0.2.8.
- #27 requirements: bounded snapshots, timestamp/provider/result, diff for added/removed/renamed/changed metadata, selected-catalog rollback, no allowlist mixing, dry-run read-only, restart/diff/retention/staging tests.
- Current reuse: `lib/models.js` normalization, `lib/reconcile.js` reconciliation, `modelCatalogs` cache, and revision-safe DSH settings writes.
- Rename matching will be explicit-only (`aliases`/`previousIds`); no fuzzy inference.
