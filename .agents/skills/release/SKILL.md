---
name: release
description: Prepare, validate, and publish a Pake release. Not for version bumps without release intent.
version: 1.0.0
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
disable-model-invocation: true
---

# Release Skill

Use this skill when preparing or executing a Pake release.

## Version Files

Three files must be updated in sync — never update one without the others:

- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version` under `[package]`
- `src-tauri/tauri.conf.json` → `"version"`

## Release Checklist

### Pre-Release

1. [ ] Confirm the new version number (check current: `cat package.json | jq .version`)
2. [ ] Update all three version files above
3. [ ] Run `pnpm run format` — must pass cleanly
4. [ ] Run `pnpm test` — must pass cleanly. If the release workflow step fails with `pnpm install ... exit code 1` against the CN mirror, re-run once; a single transient flake is acceptable, two consecutive failures is not.
5. [ ] Run `pnpm run cli:build` — Rollup + TS must pass (catches type errors that `format` misses).
6. [ ] No uncommitted changes: `git status`
7. [ ] Commit version bump with message: `chore: bump version to VX.X.X`

### Tagging (triggers CI)

```bash
git tag -a VX.X.X -m "Release VX.X.X"
git push origin VX.X.X
```

Tag format: uppercase `V` prefix (e.g. `V3.11.0`), not `v3.11.0`.

### Post-Tag Verification

1. [ ] Confirm CI triggered: `gh run list --workflow=release.yml`
2. [ ] Watch CI status: `gh run watch`
3. [ ] Verify GitHub Release was created: `gh release view VX.X.X`
4. [ ] Publish to npm (manual): `npm publish`

## Build Commands (local only)

```bash
# Current platform
pnpm build

# macOS universal binary
pnpm build:mac
```

Cross-platform builds (Windows/Linux) are handled by CI, not locally.

## Safety Rules

1. **NEVER** auto-commit or auto-push without explicit user request
2. **NEVER** tag before all checks pass
3. **ALWAYS** verify the three version files are in sync before tagging
