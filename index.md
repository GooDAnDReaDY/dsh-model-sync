# dsh-model-sync

Automatic model catalog synchronization for API-key providers in DeepSeek Harness.

- Status: implemented; v0.2.7 patch release candidate
- Entry point: ``lib/index.js``
- Bundle: ``cordis.patch.yml``
- Tests: npm test (33/33 currently passing)
- Architecture: [docs/architecture/baseline.md](docs/architecture/baseline.md)
- Research: [docs/research/reuse.md](docs/research/reuse.md)
- Test strategy: [docs/testing/strategy.md](docs/testing/strategy.md)
- Release plan: [docs/plans/1-model-sync.md](docs/plans/1-model-sync.md)

- Model selection stores an allowlist separately from a full discovered catalog.
- After an applied run, the full catalog is persisted in the plugin namespace and
  restored for the picker after a DSH restart; dry-run does not write it.
- Release candidate checks: npm test, node --check, git diff --check, npm audit.

- Deployment: deploy.sh with explicit approval guard; see docs/deployment/production.md.
