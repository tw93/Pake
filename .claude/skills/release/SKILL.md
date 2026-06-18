---
name: release
description: Prepare, validate, and publish a Pake release. Not for version bumps without release intent.
version: 1.1.0
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

Four files must be updated in sync — never update one without the others:

- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version` under `[package]`
- `src-tauri/Cargo.lock` → `version` for package `pake`
- `src-tauri/tauri.conf.json` → `"version"`

## Release Checklist

### Pre-Release

1. [ ] Confirm the new version number (check current: `cat package.json | jq .version`)
2. [ ] Confirm the version is not already on npm: `npm view pake-cli@X.Y.Z version` should return 404 before publishing
3. [ ] Update all four version files above
4. [ ] Run `pnpm run format` — must pass cleanly
5. [ ] Run `pnpm test` — must pass cleanly. If the release workflow step fails with `pnpm install ... exit code 1` against the CN mirror, re-run once; a single transient flake is acceptable, two consecutive failures is not.
6. [ ] Run `pnpm run cli:build` — Rollup + TS must pass (catches type errors that `format` misses).
7. [ ] Run `pnpm run release:check` — verifies version sync, package contents, and npm dry-run
8. [ ] No uncommitted changes: `git status`
9. [ ] Commit version bump with message: `chore: bump version to VX.X.X`

### Tagging (triggers CI)

```bash
git tag -a VX.X.X -m "Release VX.X.X"
git push origin VX.X.X
```

Tag format: uppercase `V` prefix (e.g. `V3.11.0`), not `v3.11.0`.

### Post-Tag Verification

1. [ ] Confirm CI triggered: `gh run list --workflow=release.yml`
2. [ ] Watch CI status: `gh run watch`
3. [ ] Verify GitHub Release was created: `gh release view VX.X.X --json tagName,url,assets`
4. [ ] Confirm npm workflow exists and is active: `gh workflow list --all | grep "Publish npm Package"`
5. [ ] Confirm npm Trusted Publishing triggered: `gh run list --workflow=npm-publish.yml`
6. [ ] Verify npm published the exact package: `npm view pake-cli@X.Y.Z version gitHead dist.tarball --json`
7. [ ] Verify latest now resolves to the release: `npm view pake-cli version`
8. [ ] Record Quality & Testing status separately: `gh run list --workflow=quality-and-test.yml --limit 3`

npm publishes through Trusted Publishing from `.github/workflows/npm-publish.yml`. Configure npm package settings with GitHub Actions, `tw93/Pake`, workflow file `npm-publish.yml`, and no environment. Local `npm publish` is only a fallback if CI or registry state blocks the trusted path.

Keep release surfaces separate in the final status:

- npm registry: the authority for `pake-cli` installability and CLI/npm issue closeout.
- GitHub Release/assets: the authority for app installers and popular-app artifact availability.
- Quality workflow: the authority for post-push CI health, but it can continue after npm has already shipped.
- Source/tag: the authority for what code was intended to ship.

Do not collapse these into "released" without naming which surface was verified. If GitHub Release assets are visible while `gh run list` still reports the release workflow as queued or in progress, trust `gh release view` for asset state and report the workflow state separately.

## Trusted Publishing Notes

- The first real Trusted Publishing test must use a new version and a new `V*` tag; do not retry an already-published version.
- npm package settings should use the strict publishing option: require two-factor authentication and disallow tokens. Trusted Publishing still works with this setting.
- If local fallback is unavoidable, prefer `npm exec --yes --package=pnpm@10.26.2 -- npm publish --registry=https://registry.npmjs.org` so `prepublishOnly` can find the pinned pnpm version.
- Do not reply to GitHub issues or close them as released until `npm view pake-cli@X.Y.Z version` returns the expected version. `npm view pake-cli version` alone is not enough because `latest` can point at a different commit than the fix under review.
- A `workflow_dispatch` run may execute on `main`; do not treat `headBranch`, run title, or compare UI as the release tag. Check the pushed tag and published package `gitHead`.
- If CI creates `chore: update contributors [skip ci]` after the tag is pushed, fast-forward local `main` after the release. Do not retag just to include generated contributor art.

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
3. **ALWAYS** verify the four version files are in sync before tagging
