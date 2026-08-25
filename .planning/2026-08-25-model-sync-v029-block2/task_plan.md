# dsh-model-sync v0.2.9 — block 2

## Goal
Implement the second five-item block without changing the package patch version until all five issues are complete. Release exactly one patch bump to 0.2.9 after issue #27, #32, #33, #34, and #35 are merged and staging is verified.

## Scope
1. #27 persistent bounded synchronization history, deterministic diff, explicit rename matching, safe selected-catalog rollback.
2. #32 stale/deprecated model lifecycle.
3. #33 credentialRef diagnostics.
4. #34 reports and notifications.
5. #35 adapter registry.

## Workflow
- Issue comment with reuse-first findings before implementation.
- One feature branch/PR per issue, offline tests, review/merge through Gitea.
- Staging only from canonical DEV artifact; no production deploy/restart.
- Release bump is the final block step only.

## Phases
- [x] Phase 1 — scope and reuse-first research
- [ ] Phase 2 — #27 history and rollback
- [ ] Phase 3 — #32 stale/deprecated lifecycle
- [ ] Phase 4 — #33 credentialRef diagnostics
- [ ] Phase 5 — #34 reports/notifications
- [ ] Phase 6 — #35 adapter registry
- [ ] Phase 7 — block review, tests, staging, release 0.2.9
