# Model Sync: diff preview and capability filters

## Goal

Implement issue #67 (explicit diff preview before applying changes) and issue #68 (model picker filters by normalized capabilities), with tests, documentation, and a staging verification. Do not publish or deploy production without a separate release approval.

## Phases

### Phase 1 — contract and issue setup

Status: complete

Created Gitea issues #67 and #68. Confirmed the current API already returns normalized model metadata and per-provider diff during dry-run.

### Phase 2 — diff preview

Status: complete

Add a client preview state and a clear apply action. Keep dry-run read-only and retain stale-model confirmation for apply.

### Phase 3 — capability filters

Status: complete

Add a reusable pure filter helper and a multi-select capability control in the model picker.

### Phase 4 — verification and staging

Status: blocked

Code checks pass, but staging installation is blocked by the pre-existing missing dsh-voice file dependency tracked in goodandready/dsh-voice#21. Profile changes require separate user approval.

Run tests, update docs/changelog, build a release candidate, install once in staging, and verify the UI/API.

### Phase 5 — release gate

Status: pending

Prepare release metadata. Ask the user before npm/GitHub publication and production deployment.

## Next Step

Wait for resolution/approval of the staging profile blocker, then install the feature tarball once and verify the UI/API.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| PowerShell quoting broke a remote Python -c issue creator | 2 | Sent the script through SSH stdin instead |

## Decisions

- The two features are tracked separately as Gitea issues #67 and #68 but implemented in one branch and one release candidate.
- Capability filtering uses only normalized model.capabilities; no inference from model ids or names.
- The preview must be explicit and read-only; applying changes remains a separate action.
