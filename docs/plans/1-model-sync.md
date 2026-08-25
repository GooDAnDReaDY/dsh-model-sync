# Implementation plan

1. Scaffold and workflow
2. Provider inventory and normalized model schema
3. DSH provider discovery service
4. Generic OpenAI-compatible adapter
5. Provider-specific adapter registry
6. Credential-safe request layer
7. Diff and reconciliation engine
8. Scheduler, manual run, and dry-run
9. Settings API and UI
10. Unit, integration, and staging tests
11. Release metadata, publication, and DSH Awesome discovery

Completed: 1, 2, 3, 4, 5, 6, 7, 8, 9. Reconciliation updates additions and metadata, preserves missing models by default, and supports explicit pruning. The runtime now has a dry-run-first scheduler, manual API, revision-safe apply path, bilingual Settings UI, separate model allowlists, and persistent full-catalog cache and opt-in per-provider scheduling.

The #29 normalization, #31 reliability, and #30 health-check steps are complete on the block branch. Current roadmap is split into two patch blocks. Block `v0.2.8` is the
reliability and selection foundation: #29 metadata normalization, #31 resilient
mass sync, #30 provider health, #28 persistent selection policies, and #26
background scheduling. Block `v0.2.9` follows with #27 history, #32 model
lifecycle, #33 credential diagnostics, #34 reporting, and #35 adapter registry.
Block 2 has #27, #32, #33, and #34 merged; #35 adds the validated adapter registry and explicit runtime escape hatch while preserving existing adapters. The block still has no version bump; after #35 and staging smoke it will release once as 0.2.9.
The version changes once after each complete five-issue block.

Block 1 implementation and staging verification are complete. The release branch
now carries the single patch bump to `0.2.8`; after the release PR/tag, the next
roadmap block targets `0.2.9` with no version change inside that block.
