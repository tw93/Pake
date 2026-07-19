---
name: release
description: Prepare, validate, and publish a Pake release. Not for version bumps without release intent.
version: 1.6.0
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

1. [ ] Confirm the new version number (check current: `cat package.json | jq .version`; previous tag: `git tag --list 'V*' --sort=-version:refname | head -1` — a bare `git tag --sort` picks up stray non-version tags like `list` and `continuous`)
2. [ ] Confirm the version is not already on npm: `npm view pake-cli@X.Y.Z version` should return 404 before publishing
3. [ ] Update all four version files above
4. [ ] Run `pnpm run format` — must pass cleanly
5. [ ] Run `pnpm test` — must pass cleanly. If the release workflow step fails with `pnpm install ... exit code 1` against the CN mirror, re-run once; a single transient flake is acceptable, two consecutive failures is not.
6. [ ] Run `pnpm run cli:build` — Rollup + TS must pass (catches type errors that `format` misses).
7. [ ] Run `pnpm run release:check` — verifies version sync, package contents, and npm dry-run
8. [ ] No uncommitted changes: `git status`. Local tests and builds leave tracked churn (`src-tauri/pake.json`, `tauri.conf.json`, `tauri.macos.conf.json`, regenerated icons); `git restore` it instead of committing it.
9. [ ] Commit version bump with message: `chore: bump version to VX.X.X`. Include the rebuilt `dist/cli.js` (it embeds the version); stage it with `git add -f dist/cli.js` since `dist/` is gitignored.

### Tagging (triggers CI)

```bash
git tag -a VX.X.X -m "Release VX.X.X"
git push origin VX.X.X
```

Tag format: uppercase `V` prefix (e.g. `V3.11.0`), not `v3.11.0`.

If the bump push is rejected, the contributors bot pushed `chore: update contributors [skip ci]` in between: `git pull --rebase` onto it and push again, then tag. Do not force-push and do not tag the pre-rebase commit.

### Post-Tag Verification

1. [ ] Confirm CI triggered: `gh run list --workflow=release.yml`
2. [ ] Poll CI status: `gh run view <run-id> --json status,conclusion` (never pipe `gh run watch` or build output to `tail`/`head`; pipes swallow the real exit code and misreport failures as green)
3. [ ] Verify GitHub Release was created: `gh release view VX.X.X --json tagName,url,assets`
4. [ ] Fill the GitHub Release title and body from the template in **GitHub Release Notes** below. CI's `create-release` step only makes a bare placeholder (title = `VX.X.X`, empty body); do not leave it bare.
5. [ ] Confirm npm workflow exists and is active: `gh workflow list --all | grep "Publish npm Package"`
6. [ ] Confirm npm Trusted Publishing triggered: `gh run list --workflow=npm-publish.yml`
7. [ ] Verify npm published the exact package: `npm view pake-cli@X.Y.Z version gitHead dist.tarball --json`
8. [ ] Verify latest now resolves to the release: `npm view pake-cli version`
9. [ ] Record Quality & Testing status separately: `gh run list --workflow=quality-and-test.yml --limit 3`
10. [ ] After the notes are published, add all six positive reactions to the release: resolve the release id from the tag, POST `+1`, `laugh`, `heart`, `hooray`, `rocket`, and `eyes` each to `repos/tw93/Pake/releases/<id>/reactions` via `gh api`, then re-read the reactions to confirm. Never add `-1` or `confused`.

npm publishes through Trusted Publishing from `.github/workflows/npm-publish.yml`. Configure npm package settings with GitHub Actions, `tw93/Pake`, workflow file `npm-publish.yml`, and no environment. Local `npm publish` is only a fallback if CI or registry state blocks the trusted path.

Keep release surfaces separate in the final status:

- npm registry: the authority for `pake-cli` installability and CLI/npm issue closeout.
- GitHub Release/assets: the authority for app installers and popular-app artifact availability.
- Quality workflow: the authority for post-push CI health, but it can continue after npm has already shipped.
- Source/tag: the authority for what code was intended to ship.

Do not collapse these into "released" without naming which surface was verified. If GitHub Release assets are visible while `gh run list` still reports the release workflow as queued or in progress, trust `gh release view` for asset state and report the workflow state separately.

## npm-Only Hotfix (no tag)

For CLI or Rust-template fixes that must reach npm fast without an app release. Precedent: 3.15.0 and 3.15.2 shipped this way; the version number is still consumed, so the next `V*` tag skips over it.

1. [ ] Bump all four version files, rebuild `dist/cli.js` with `pnpm run cli:build`, stage the version files, and stage the ignored artifact with `git add -f dist/cli.js`
2. [ ] Run `pnpm run release:check`. For a Rust-template fix, also run the narrow current-platform Rust check before pushing. Do not run `npx vitest run` separately because `release:check` already includes it.
3. [ ] Commit `chore: bump version to VX.Y.Z` and push `main`
4. [ ] Record the exact commit selected for publishing with `git rev-parse HEAD`. Find its Quality & Testing run with `gh run list --workflow=quality-and-test.yml --commit <publish-sha> --limit 3 --json databaseId,headSha,status,conclusion`. Wait until that exact SHA is `completed` with `conclusion: success`. For Rust-template changes, confirm the Windows real Tauri build job passed before publishing.
5. [ ] Dispatch with both gates: `gh workflow run npm-publish.yml --ref main -f expected_sha=<publish-sha> -f quality_run_id=<quality-run-id>`. If `main` moved, select the new exact head and wait for its own successful Quality run instead of publishing against stale evidence.
6. [ ] Poll the npm workflow with `gh run view <run-id> --json headSha,status,conclusion`; its `headSha` must match `<publish-sha>`.
7. [ ] Verify `npm view pake-cli@X.Y.Z version gitHead dist.tarball --json`; `gitHead` must match `<publish-sha>`. Check `npm view pake-cli version` separately for the `latest` pointer.
8. [ ] Issue closeout per AGENTS.md; if the fix lives in the Rust template, tell users to rebuild their app after upgrading, because upgrading the CLI alone does not update already-built apps

Skip list, do not do these for a hotfix: no `V*` tag, no GitHub Release or notes, no release reactions, no Docker. App-release surfaces stay untouched until the next `V*` release bundles the fix.

## GitHub Release Notes

CI only creates a bare placeholder release. Every published release must be edited to match the house format, or it looks broken next to the others. Before writing notes, run `gh release view <previous release>` and treat its structure as the hard template, title codename included. Two failure modes to avoid: a bare version title with no codename, and a body missing the logo header / star line / repo footer (see `V3.11.10` and `V3.12.0`, both fixed after the fact).

### Title format

`V<X.Y.Z> <Codename>` — version, then a single English codename word, optionally with one emoji. Examples: `V3.11.8 Polish`, `V3.11.10 Bedrock`, `V3.12.0 Gateway`, `V3.11.0 Evolve 👻`. The codename is the maintainer's call; pick one that fits the release theme. Even patch releases get a codename.

### Body template

Fill in the version, the two changelog lists (English + 中文, same items in the same order, numbered), the thanks line (credit the reporters/PR authors behind the release), and keep the logo header and repo footer verbatim:

```markdown
<div align="center">
<img src="https://gw.alipayobjects.com/zos/k/fa/logo-modified.png" alt="Pake Logo" width="120" height="120" style="border-radius:50%" />
<h1 style="margin: 12px 0 6px;">Pake VX.Y.Z</h1>
<p><em>Turn any webpage into a desktop app with one command.</em></p>
</div>

### Changelog

1. ...

### 更新日志

1. ...

Special thanks to @user for the reports and PRs behind this release. If Pake helps you, please consider giving it a star and recommending it to your friends.

> https://github.com/tw93/Pake
```

Apply with a notes file to avoid shell escaping: `gh release edit VX.Y.Z --title "VX.Y.Z Codename" --notes-file notes.md`. Source changelog items from the real commit range (`git log VPREV..VX.Y.Z`), keep them user-facing, and drop pure CI/refactor/docs noise.

## Trusted Publishing Notes

- The first real Trusted Publishing test must use a new version and a new `V*` tag; do not retry an already-published version.
- npm package settings should use the strict publishing option: require two-factor authentication and disallow tokens. Trusted Publishing still works with this setting.
- If local fallback is unavoidable, prefer `npm exec --yes --package=pnpm@10.26.2 -- npm publish --registry=https://registry.npmjs.org` so `prepublishOnly` can find the pinned pnpm version.
- Do not reply to GitHub issues or close them as released until `npm view pake-cli@X.Y.Z version` returns the expected version. `npm view pake-cli version` alone is not enough because `latest` can point at a different commit than the fix under review.
- A `workflow_dispatch` run executes on a branch. For npm-only publishing, pass the exact `main` commit as `expected_sha` and a successful Quality run for that SHA as `quality_run_id`; the workflow rejects mismatches. Do not treat `headBranch`, run title, or compare UI as proof of the published source.
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
