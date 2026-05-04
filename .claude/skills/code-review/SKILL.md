---
name: code-review
description: Pake project adapter for Waza check/code-review. Use for TypeScript CLI, Rust/Tauri, release artifact, and CI review.
version: 1.1.0
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
- [ ] Release version bumps keep `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` in sync.
- [ ] No new `tauriConf: any` or other untyped config objects; use `PakeTauriConfig`.
- [ ] No user-reachable `panic!` or `.unwrap()` on config, CLI, or event paths.
- [ ] Silent `catch {}` blocks surface the real error through `logger.warn`.
- [ ] New helper in `bin/utils/` or `bin/helpers/` has a matching `tests/unit/<basename>.test.ts`.
- [ ] Binary parsers have a round-trip test, not only builder assertions.

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
