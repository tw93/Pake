# AGENTS.md - Pake Project Knowledge Base

> Project-specific Rust + Tauri rules: `.claude/rules/rust.md`. Release runbook: `.agents/skills/release/SKILL.md` (run `/release`; `.claude/skills/*` are symlinks into `.agents/skills/`, edit the `.agents` copy only). Exception: the `pake` skill's real source is `plugins/pake/skills/pake/SKILL.md` (shipped to users via the Claude Code plugin marketplace, `.claude-plugin/marketplace.json`); `.agents/skills/pake` is a symlink to it.

## Project Identity

**Pake** - Turn any webpage into a lightweight desktop app with one command.

- **Purpose**: Package any website into a ~5MB desktop app (20x smaller than Electron)
- **Stack**: Tauri v2 (Rust) + TypeScript CLI
- **Platforms**: macOS, Windows, Linux
- **Mechanism**: Uses system webview (WebKit on macOS/Linux, WebView2 on Windows)

## Repository Structure

```
Pake/
├── bin/                   # CLI source code (TypeScript)
│   └── cli.ts            # Main CLI entry (Commander.js)
├── src-tauri/             # Tauri Rust application
│   ├── src/              # Rust source code
│   ├── src/app/          # window creation, setup, menu, config, and invokes
│   ├── src/inject/       # injected JS/CSS behavior
│   ├── Cargo.toml        # Rust dependencies and version
│   ├── tauri.conf.json   # Tauri configuration and version
│   └── .cargo/           # Cargo configuration (gitignored)
├── dist/                 # Compiled CLI output
├── docs/                 # Documentation
│   ├── cli-usage.md      # CLI parameters
│   ├── advanced-usage.md # Customization guide
│   └── faq.md           # Troubleshooting
├── schema/               # pake.schema.json: --config JSON schema (public contract)
├── plugins/              # Claude Code plugin source (user-facing pake skill)
├── llms.txt              # Agent-facing contract summary (--json, --config, exit codes)
├── scripts/              # Utility scripts
├── tests/                # Unit, integration, and release-flow tests
├── .github/workflows/     # quality/test and release automation
├── default_app_list.json # Popular apps config for release builds
├── package.json          # Node.js dependencies and version
└── rollup.config.js      # CLI build configuration
```

## Development Commands

| Command                              | Purpose                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| `pnpm install`                       | Install dependencies                                            |
| `pnpm run dev`                       | Tauri development mode                                          |
| `pnpm run cli:dev -- <url>`          | CLI wrapper + Tauri (recommended)                               |
| `pnpm run cli:dev --iterative-build` | Faster dev (skip checks)                                        |
| `pnpm run cli:build`                 | Rollup + TypeScript check (catches type errors Prettier misses) |
| `pnpm run build`                     | Build for current platform                                      |
| `pnpm run build:mac`                 | macOS universal binary                                          |
| `pnpm run format`                    | Format code (prettier + cargo fmt)                              |
| `npx vitest run`                     | Unit and integration tests only (sub-second)                    |
| `pnpm test -- --no-build`            | Full suite minus the multi-arch real build                      |
| `pnpm test`                          | Full suite including release workflow                           |

Keep shared project facts in this file so Codex, Claude Code, and other agents use the same source of truth. `CLAUDE.md` is a symlink to this file, so edit `AGENTS.md` only. Local-only overrides (`CLAUDE.local.md`, `AGENTS.override.md`, `.claude/settings.local.json`) stay ignored.

## Code Conventions

- No Chinese comments in any source (Rust / TypeScript / any file). Comments and identifiers in English; follow the existing language of surrounding prose.

## Working Principles

Goals and project facts only; trust the agent to find its own path.

- Deliver the smallest correct diff and prove it with the narrowest real verification; expand only when evidence demands it. If key context is missing, make one reasonable assumption and proceed.
- Generated areas (`dist/`, `node_modules/`, `src-tauri/target/`, `.app/`, `src-tauri/icons/`, `src-tauri/png/`) are not source. Exception: `dist/cli.js` is the shipped CLI build artifact (see `package.json` `files`); any change under `bin/` rebuilds it via `pnpm run cli:build` and commits the regenerated file alongside the source change.
- Release status, issue closeout, npm delivery, and GitHub assets are separate truth surfaces. Verify each one live (source commit/tag, workflow run, npm registry, GitHub Release/assets, issue state); never let one passing surface imply another.

## Current Risk Areas

- CLI options are user-facing and must stay synchronized across `bin/helpers/cli-program.ts`, `bin/types.ts`, `bin/defaults.ts`, `bin/helpers/merge.ts`, generated `dist/cli.js`, `schema/pake.schema.json`, and `docs/cli-usage*.md`. Schema-to-CLI sync is enforced by `tests/unit/config-file.test.ts`; the rest is manual discipline.
- The `--json` machine contract is public API for agents: stdout carries exactly one JSON result (nothing else may write to stdout in machine mode), and the exit codes (0/2/3/4/1) plus error codes (`INVALID_INPUT`, `ENV_MISSING`, `BUILD_FAILED`, `NETWORK`, `UNEXPECTED`) must stay stable. `logger.warn` feeds the JSON `warnings` array, so warn is for real warnings only, not status lines. Owners: `bin/utils/output.ts`, `bin/cli.ts`, `bin/utils/shell.ts`.
- Local file/directory packaging stages user content into the package's own `dist/` (moving it to `dist_bak` and restoring only `cli.js`). Local build runs can strand `dev.js` and test fixtures in `dist_bak`; restore them before committing. Owner: `stageLocalTree` in `bin/helpers/merge.ts`.
- New user-visible CLI surface (a new flag, alias, subcommand, or extra help variant) needs a stated justification before implementation: name the user problem and why an existing flag, config key, or default cannot cover it, then get maintainer sign-off. Prefer quieter defaults over new options; never split help output into parallel variants.
- Window/runtime options with platform-sensitive behavior include `--incognito`, `--new-window`, `--min-width`, `--min-height`, `--maximize`, multi-window behavior, notification click handling, and Linux/Wayland WebKit compositing defaults.
- `--incognito` intentionally trades persistence for clean private sessions; be careful around login, cookies, local storage, and WeChat-style WebView detection.
- `--new-window` and `--multi-window` do not bypass every provider policy. Google OAuth and similar embedded-WebView restrictions may still require a normal browser or native client.
- macOS auth-popup behavior is fragile. Auth/sign-in URLs that trigger WebKit `SOAuthorization` popup creation should stay in the current window when that path can abort the app; changes in `src-tauri/src/inject/event.js` need targeted tests. Apple Sign-In (`appleid.apple.com` / `AppleAuthentication` named windows) is the exception and must keep the native `window.open` popup.
- Safe clipboard shortcuts (Ctrl+C/X/V/A) on Linux/Windows are bridged in `src-tauri/src/inject/event.js`. Copy/cut/select-all stay in the trusted `handleClipboardShortcut` keydown path; Ctrl+V must leave keydown unhandled so the native WebView paste event preserves images, files, and rich formats, with text-only `navigator.clipboard.readText()` fallback allowed only from a trusted keyup when no native paste event fired. The bridge is gated on `isNonMacDesktop()` and `event.isTrusted`, only acts on editable/selected targets, and must never fire on macOS (native shortcuts already work). Locked by `event-clipboard-shortcuts.test.js` tests `lets native paste preserve non-text clipboard data` and `falls back to clipboard text only when native paste does not fire`.
- Notification flows cross injected JS, Tauri invokes, capabilities, and native notification plugins. Verify the Rust capability and JS caller together.
- WebKit compositing behavior is platform-sensitive on Linux/Wayland. Runtime flag decisions live in `src-tauri/src/lib.rs`; keep the default conservative, cover compositor exceptions with unit tests, and document user-facing fallbacks in `docs/faq*.md`.
- Linux AppImage reports often include harmless GTK, appindicator, or GStreamer warnings. Separate optional runtime warnings from the actual symptom before changing code; input/click failures on pure Wayland compositors are not the same class as blank-window failures.
- Release state can be split. npm Trusted Publishing can succeed before the popular-app release workflow finishes, and GitHub Release assets can exist while a workflow run still shows queued or in progress. Report each surface explicitly.
- Local app builds and test runs mutate tracked files as build state: `src-tauri/pake.json`, `src-tauri/tauri.conf.json`, `src-tauri/tauri.macos.conf.json`, and regenerated icons under `src-tauri/png/` and `src-tauri/icons/`. Before committing, `git restore` whatever you did not intentionally change; never let a feature or release commit absorb this churn.
- Per-app optional fields in `default_app_list.json` consumed by workflows must get their defaults in the jq read step of `release.yml`, not in Actions expressions: GitHub expressions cast both `null` and `false` to `0`, so `matrix.config.x != false` cannot express "default true" and silently flips every app missing the field.
- Windows taskbar icons can register blank when an autostarted app launches before Explorer's icon cache is ready (#1323). Every hidden-to-visible path for the main window (tray show/click, activation shortcut, single-instance activation, initial delayed show) must call `reapply_window_icon` from `src-tauri/src/app/window.rs`, which reasserts both the small window icon and the large taskbar icon; adding a new `window.show()` path without it regresses the bug.
- `.github/workflows/pake-cli.yaml` and `single-app.yaml` are public build surfaces that external users trigger from their own forks (see `docs/github-actions-usage*.md`). Changes there ship to outside users on push to `main`, independent of `V*` releases; treat them like public API, not internal CI.

## Platform-Specific Development

### macOS

- Universal builds via `--multi-arch` (Intel + Apple Silicon).
- Icons: `.icns`.
- Title bar can be customized via Tauri window options.

### Windows

- Requires Visual Studio Build Tools to compile.
- Icons: `.ico`.
- MSI installer supported via Tauri bundler.

### Linux

- Multiple package formats: `.deb`, `.AppImage`, `.rpm`.
- Runtime depends on `libwebkit2gtk` and its companion libraries.
- Icons: `.png`.
- WebKit compositing is platform-sensitive on Wayland; see Current Risk Areas before changing defaults.

## Branch Strategy

- `main` - Only branch. All development and releases happen here directly.

## Version Management

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

## Release Workflow (CI)

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
- For CLI/npm issue closeout, the npm registry is the decisive public surface. GitHub app release assets and quality workflows should still be reported, but they are separate surfaces.
- For app-release claims, inspect the GitHub Release directly with `gh release view <tag> --json assets` and check asset count/state instead of trusting source state or workflow names alone.
- The contributors bot can push `chore: update contributors [skip ci]` at any moment, including between local commits and the bump push. On a rejected push, `git pull --rebase` onto it and push again before tagging. After release, fast-forward local `main`; do not move an already pushed release tag to include it.

`.github/workflows/quality-and-test.yml` runs auto-format on push, Rust quality checks, and CLI/build validation across Linux, Windows, and macOS.

Deployment-surface note: the Claude Code plugin (`.claude-plugin/marketplace.json` + `plugins/pake`) ships from `main` via git, independent of `V*` releases. Skill and manifest edits reach new installs as soon as they land on `main`; npm and app assets still wait for their release workflows.

### Network Mirror Behavior

Pake uses official npm and Rust sources by default. CN mirrors are explicit opt-in only:

- Set `PAKE_USE_CN_MIRROR=1` only when the user or CI environment intentionally wants npmmirror/rsProxy.
- Do not reintroduce automatic China-domain mirror switching.
- If an install fails against a CN mirror, retry the same install command to separate network availability from a product regression.
- `bin/utils/mirror.ts` and `bin/builders/BaseBuilder.ts` own this behavior; keep docs and tests aligned when changing it.

## Issue Closeout After a Fix

Default loop for a fixed user-reported CLI bug: ship the fix as an npm patch release first, then reply to the reporter with the concrete upgrade command (`npm install -g pake-cli@latest`, or `pake-cli@X.Y.Z` when `latest` may point elsewhere), then close the issue noting it can be reopened if the problem persists. Do not reply "fixed" pointing at an unreleased commit; the npm registry must return the fix version first. The publish itself follows the authorization rule in Release Workflow above.

## Community PR Triage

Sort every community PR into one of three outcomes; never rewrite a contribution as a new self-authored PR:

- **Merge as-is**: implementation is sound. Verify locally (build + relevant tests), merge, thank the author.
- **Right direction, implementation needs work**: push fixes directly onto the contributor's branch so their authorship is preserved, then merge and reply summarizing what was changed and why.
- **Out of scope**: close as not planned with a one-line apology and the boundary reason (what Pake deliberately does not do). Keep it friendly and leave room for discussion.

## Troubleshooting

See `docs/faq.md` for common issues and solutions.

### macOS SDK / Compile Errors

If compilation errors occur (e.g. on macOS beta), create `src-tauri/.cargo/config.toml`:

```toml
[env]
MACOSX_DEPLOYMENT_TARGET = "15.0"
SDKROOT = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
```

This file is already in `.gitignore`.

### `dist/cli.js` out of sync with `bin/`

Symptom: tests or release builds use stale CLI behavior after a `bin/` edit. Fix with `pnpm run cli:build` and commit the regenerated `dist/cli.js`. Note `dist/` is gitignored while `dist/cli.js` is tracked, so stage it with `git add -f dist/cli.js`. The file embeds the package version, so version bumps must also rebuild and commit it.

### First Tauri build is slow

The first `cargo build` on a fresh clone takes 10+ minutes as Cargo compiles every Tauri dependency from source. Subsequent builds reuse the `src-tauri/target/` cache. This is expected, not a bug.

## Documentation Guidelines

- **Main README**: keep only common, frequently-used parameters to avoid clutter.
- **CLI Documentation** (`docs/cli-usage.md` and locale variants): include **all** CLI parameters with detailed usage examples.
- **Rare or advanced parameters**: should have full documentation in `docs/cli-usage*.md` but minimal or no mention in the main README. Examples: `--title`, `--incognito`, `--system-tray-icon`, `--multi-window`, `--min-width`, `--min-height`.
- **README popular-packages showcase**: apps render in pairs of `<td>` cells, each with a 600px-wide screenshot from `https://raw.githubusercontent.com/tw93/static/main/pake/<Title>.png` (source spec 2624x1784, a Retina window capture). Upload the screenshot to `tw93/static` before pushing the README row, and note the app's download links stay 404 until the next `V*` release builds its assets.
- **App list curation**: judge showcase or `default_app_list.json` additions and removals with real demand from `gh release view <tag> --json assets` download counts, not intuition. Keep both README locales in the same order.
- **Key configuration files**:
  - `src-tauri/pake.json` - default app configuration (CLI options are merged into it at build time).
  - `src-tauri/tauri.conf.json` - shared Tauri settings.
  - `src-tauri/tauri.{macos,windows,linux}.conf.json` - per-platform overrides.
