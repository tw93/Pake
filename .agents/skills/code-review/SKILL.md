---
name: code-review
description: Pake project adapter for Waza check/code-review. Use for TypeScript CLI, Rust/Tauri, release artifact, and CI review.
version: 1.2.0
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
disable-model-invocation: true
---

# Pake Code Review Adapter

Use Waza `/check` for the generic review method. This adapter adds Pake-specific commands, hard stops, and artifact rules.

## Pake-Specific Hard Stops

- [ ] Changes under `bin/` rebuild and commit `dist/cli.js` with `pnpm run cli:build`.
- [ ] Changes to package metadata embedded by Rollup (`package.json` name/version/repository/bin/scripts/exports) rebuild and commit `dist/cli.js`.
- [ ] Release version bumps keep `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json` in sync.
- [ ] npm release workflow changes preserve Trusted Publishing: `.github/workflows/npm-publish.yml`, `id-token: write`, canonical `git+https://github.com/tw93/Pake.git`, and `scripts/check-release-version.mjs`.
- [ ] Release/status changes keep npm registry, GitHub Release/assets, workflow run state, and issue closeout as separate truth surfaces.
- [ ] `workflow_dispatch` release logic does not infer the release tag from `headBranch`, run title, or compare UI; use an explicit tag/ref and verify the package `gitHead`.
- [ ] Any new user-visible CLI flag, alias, or help variant carries an explicit justification for why existing options or defaults cannot cover it (maintainer sign-off, not inferred).
- [ ] No new `tauriConf: any` or other untyped config objects; use `PakeTauriConfig`.
- [ ] No user-reachable `panic!` or `.unwrap()` on config, CLI, or event paths.
- [ ] Silent `catch {}` blocks surface the real error through `logger.warn`.
- [ ] New helper in `bin/utils/` or `bin/helpers/` has a matching `tests/unit/<basename>.test.ts`.
- [ ] Binary parsers have a round-trip test, not only builder assertions.
- [ ] Linux WebKit/AppImage runtime flag changes keep the default conservative, add or update tests for the decision logic, and update `docs/faq*.md` when users need a fallback command.
- [ ] macOS `--new-window` or auth URL changes include targeted tests for popup/auth routing in `src-tauri/src/inject/event.js`.

## Quick Review Commands

```bash
# Get PR diff
gh pr diff

# Format check
pnpm run format:check

# Run unit tests (fast, sub-second)
npx vitest run

# Full suite without the slow real build
pnpm test -- --no-build

# Build CLI and catch TypeScript errors
pnpm run cli:build
```

## Review Output Format

Follow Waza `/check`: findings first, ordered by severity, with tight file/line references. Keep summaries brief.
