# dsh-model-sync implementation

Goal: publish and verify a safe API-key model catalog synchronizer for DSH.

## Phases

- [x] Phase 1: scaffold, repository, issue, and workflow files
- [x] Phase 2: provider inventory and normalized model schema
- [x] Phase 3: DSH provider discovery service
- [x] Phase 4: generic OpenAI-compatible adapter
- [x] Phase 5: provider-specific adapter registry
- [x] Phase 6: credential-safe request layer
- [x] Phase 7: diff and reconciliation engine
- [x] Phase 8: scheduler, manual run, and dry-run
- [x] Phase 9: settings API and UI
- [x] Phase 10: unit, integration, browser smoke, and staging tests
- [x] Phase 11: release metadata, publication, and production deployment

## Decisions

- Only API-key authentication modes are in scope.
- OAuth and subscriptions are excluded.
- DSH Awesome discovery is achieved through a public GitHub repository and the dsh-plugin topic, not artificial commits.
- Provider identities come from the DSH configurable-provider directory.
- Built-in API-key capability uses the installed DSH/pi-ai provider catalog; custom routes require apiKeyEnv.
- The runtime service re-reads inventory on each call and performs no network request.
- Generic discovery is limited to OpenAI-compatible models endpoints; other protocols need explicit adapters.
- Source files are verified with npm test and node --check before each commit.
- Adapter selection is deterministic: generic first, then provider-specific descriptor, otherwise unsupported.
- Credentials are resolved through DSH only and never written to logs, settings, or response metadata.
- Missing advertised models are retained by default and only pruned when explicitly requested.
- Staging validation uses the compose proxy endpoint and a clean profile without API-key routes; real apply remains a release/operator check with configured credentials.
- The staging pnpm store must be selected explicitly with PNPM_CONFIG_STORE_DIR=/data/dsh/.pnpm-store when repairing this profile.
- The Settings UI lists only providers whose API-key route is actually configured; the built-in capability catalog remains available only to the backend synchronizer.
