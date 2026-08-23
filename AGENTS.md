# AGENTS.md

This file supplements the repository-wide DEV workflow.

## Product / Purpose

- Project: dsh-model-sync
- Purpose: synchronize model catalogs for API-key DSH providers.
- Public package: @goodandready/dsh-model-sync
- Current status: scaffold
- Scope: configured and built-in API-key providers, plus future custom API-key routes.
- Out of scope: OAuth, subscription, and tool-only routes.

## Project Index

- Navigation: index.md
- Detailed documentation: docs/
- Tests: npm test
- Publication source: the tested release tree, never an unverified working tree.

## Architecture

The plugin is autonomous and uses only public DSH APIs. It must not import or depend on another plugin. Credentials are resolved through the DSH credentials service and never written to logs or settings.

## Constraints

- No infrastructure-specific paths, hosts, account names, keys, or secrets in source or public documentation.
- Work only in an assigned Git worktree.
- Every completed change includes the affected documentation and a Memory Brain update.
- Deployment or changes to a running DSH profile require explicit approval.

## Locked Decisions

- The public package uses the scoped name @goodandready/dsh-model-sync.
- Only API-key authentication modes are supported by this project.
