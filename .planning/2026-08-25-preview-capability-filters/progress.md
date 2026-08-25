# Progress

## 2026-08-25

- Read the planning-with-files instructions.
- Fetched origin/main at becfcba9392e535dea8a1768962d60c2211224f8.
- Created feature worktree feat/dsh-model-sync-preview-capability-filters.
- Created Gitea issues #67 and #68.
- Inspected lib/client.js, lib/http.js, lib/synchronizer.js, lib/models.js, lib/reconcile.js, and existing tests.

- Implemented explicit dry-run preview with per-provider added/removed/changed lists and a separate apply action.
- Implemented all-of capability filtering in the picker using explicit normalized metadata; hidden selections remain in the draft.
- Updated English/Russian labels, README, and CHANGELOG.
- npm test: 78/78 passed; node check client.js, git diff check, and npm audit high passed.

- PR #69 opened.
- Built feature tarball at .staging-preview-capability-filters; staging install was attempted inside the real container and correctly stopped on the pre-existing missing dsh-voice path.
- Read-only inventory captured all file: references and profile SHAs; dsh-voice issue #21 opened. No staging profile or production changes were made.
