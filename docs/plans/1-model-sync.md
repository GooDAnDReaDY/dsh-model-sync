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

Completed: 1, 2, 3, 4, 5, 6, 7. Reconciliation updates additions and metadata, preserves missing models by default, and supports explicit pruning. Each step is a meaningful commit and includes the affected documentation.
