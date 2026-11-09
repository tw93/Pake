---
paths:
  - "package.json"
  - "src-tauri/Cargo.toml"
  - "src-tauri/tauri.conf.json"
  - ".github/workflows/release.yml"
  - ".github/workflows/npm-publish.yml"
  - ".agents/skills/release/**"
---

# Versions and release workflow

Four files must be updated in sync for every release:

| File                        | Field                        |
| --------------------------- | ---------------------------- |
| `package.json`              | `"version"`                  |
| `src-tauri/Cargo.toml`      | `version` under `[package]`  |
| `src-tauri/Cargo.lock`      | `version` for package `pake` |
| `src-tauri/tauri.conf.json` | `"version"`                  |

A version bump must also rebuild and commit `dist/cli.js` (it embeds the package version); see Troubleshooting.

Tag format: `V<major.minor.patch>` with uppercase `V` (e.g. `V3.13.1`). Current version: check `package.json`.

Find the previous release tag with `git tag --list 'V*' --sort=-version:refname | head -1`. A bare `git tag --sort` is polluted by stray non-version tags (`list`, `continuous`, `0.1.0`) and silently picks the wrong log range.

Filter those tags out; do not delete them without checking each one first. `continuous` is not junk: it carries a real 2023 prerelease ("Continuous build") with 40 assets and roughly 700 downloads, so removing the tag breaks every historical download link. `list` and `0.1.0` point at old commits with no release attached. Any tag deletion here is a public, irreversible action and needs maintainer authorization in the current turn.
Pushing a `V*` tag triggers `.github/workflows/release.yml`:

1. **release-apps** - reads `default_app_list.json` for app list
2. **create-release** - creates the GitHub Release placeholder
3. **build-cli** - builds and uploads the `dist/` CLI artifact
4. **build-popular-apps** - builds all apps in parallel across macOS/Windows/Linux
5. **publish-docker** - builds and pushes Docker image to GHCR

The workflow can also be triggered manually via `workflow_dispatch` with options to build popular apps or publish Docker independently.

Pushing the same `V*` tag also triggers `.github/workflows/npm-publish.yml`, which publishes `pake-cli` to npm through Trusted Publishing. Configure the npm package's Trusted Publisher as GitHub Actions, `tw93/Pake`, workflow file `npm-publish.yml`, with no environment. Local `npm publish` is only a fallback when CI or npm registry state blocks the trusted path.

`npm-publish.yml` also supports `workflow_dispatch` from `main` for npm-only CLI hotfixes: bump the version files on `main`, wait for a successful `quality-and-test.yml` run for the exact commit, then pass that commit as `expected_sha` and the successful run as `quality_run_id`. The publish workflow verifies both before publishing without a `V*` tag or app release. npm publish and `git tag` are therefore independent actions; never infer one from the other. At the start of any release task, restate which surfaces this round touches (npm package, GitHub Release + app assets, Docker, git tag) and let the maintainer confirm. Each publish, tag, or issue-close action needs maintainer authorization in the current turn.

Before treating an npm release as shipped, verify both `gh workflow list --all | grep "Publish npm Package"` and `npm view pake-cli@X.Y.Z version`. Prefer `npm view pake-cli@X.Y.Z version gitHead dist.tarball --json` so the published package can be tied back to the intended commit. Do not reply to or close GitHub issues as released until the public registry returns the expected version.

For release follow-through, keep these boundaries explicit:

- `workflow_dispatch` runs on a branch. Bind npm-only publishing to the exact `main` commit with `expected_sha` and a successful Quality run for that same SHA; do not infer a release tag or source commit from the branch name, run title, or compare UI.
- For CLI/npm issue closeout, the npm registry is the decisive public surface. Install the exact public version in a temporary directory, compare its shipped files with the intended source commit (or release tag when present), build an app, and verify the installed template remains unchanged. Check `rustup show` in that temporary context before a universal macOS probe: the repository's toolchain override may have both targets while the default toolchain has only the host target. GitHub app release assets and quality workflows remain separate surfaces.
- For app-release claims, inspect the GitHub Release directly with `gh release view <tag> --json assets`. Derive the expected filenames from the tagged `default_app_list.json` and workflow formats, then require the complete name set, uploaded state, and nonzero sizes; do not hardcode a historical asset count. Download representative platform installers, inspect actual payloads, and validate a macOS DMG's stapled notarization ticket. Asset presence and workflow completion must both be reported accurately.
- The contributors bot can push `chore: update contributors and formatting [skip ci]` at any moment, usually a minute or two after each push now that it also runs Prettier and `cargo fmt`, including between local commits and the bump push. On a rejected push, `git pull --rebase` onto it and push again before tagging. After release, fast-forward local `main`; do not move an already pushed release tag to include it. Never tag that bot commit itself: GitHub evaluates `[skip ci]` against the head commit for tag pushes too, so a `V*` tag landing on it silently produces no workflow run, no release, and no assets, with no error anywhere. Before pushing a release tag, confirm the target commit's subject has no `[skip ci]` and that the commit has its own green Quality run; point the tag at the last real commit when the bot is on top.
  Deployment-surface note: the Claude Code and Codex plugins (`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, and `plugins/pake`) ship from `main` via git, independent of `V*` releases. Skill and manifest edits reach new installs as soon as they land on `main`; npm and app assets still wait for their release workflows.
