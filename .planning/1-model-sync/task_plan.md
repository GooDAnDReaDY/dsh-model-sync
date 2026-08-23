# dsh-model-sync implementation

Goal: publish and verify a safe API-key model catalog synchronizer for DSH.

## Phases

- [x] Phase 1: scaffold, repository, issue, and workflow files
- [x] Phase 2: provider inventory and normalized model schema
- [x] Phase 3: DSH provider discovery service
- [x] Phase 4: generic OpenAI-compatible adapter
- [x] Phase 5: provider-specific adapter registry
- [x] Phase 6: credential-safe request layer
- [ ] Phase 7: diff and reconciliation engine
- [ ] Phase 8: scheduler, manual run, and dry-run
- [ ] Phase 9: settings API and UI
- [ ] Phase 10: unit, integration, and staging tests
- [ ] Phase 11: release metadata and publication

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
