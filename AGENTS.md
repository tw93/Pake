# AGENTS.md - Pake Project Knowledge Base

> Project-specific Rust + Tauri rules: `.claude/rules/rust.md`. Skills live under `.agents/skills/` (`/release`; `.claude/skills/*` are symlinks into `.agents/skills/`, edit the `.agents` copy only). Exception: the `pake` skill's real source is `plugins/pake/skills/pake/SKILL.md` (shipped to users via the Claude Code and Codex plugin marketplaces, `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`); `.agents/skills/pake` is a symlink to it.

## Project Identity

**Pake** - Turn any webpage into a lightweight desktop app with one command.

- **Purpose**: Package any website into a desktop app whose installer is typically under 10 MB (nearly 20x smaller than Electron)
- **Stack**: Tauri v2 (Rust) + TypeScript CLI
- **Platforms**: macOS, Windows, Linux
- **Mechanism**: Uses system webview (WebKit on macOS/Linux, WebView2 on Windows)

## Repository Structure

`bin/` is the TypeScript CLI (`bin/cli.ts`), `src-tauri/` the Tauri app (`src/app/` window, setup, menu and config; `src/inject/` injected JS and CSS), and `dist/` the compiled CLI.
`gallery/` holds site recipes for the Pake apps' gallery, `schema/pake.schema.json` the `--config` schema, `plugins/` the Claude Code and Codex plugin source, and `llms.txt` the agent-facing contract.
`default_app_list.json` lists the popular apps for release builds; `docs/` has `cli-usage.md`, `advanced-usage.md` and `faq.md`.

## Development Commands

| Command                                    | Purpose                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `pnpm install`                             | Install dependencies                                                    |
| `pnpm run dev`                             | Tauri development mode                                                  |
| `pnpm run cli:dev`                         | Rollup watch build of `bin/dev.ts` into `dist/dev.js` (debug-level CLI) |
| `node dist/dev.js <url> --iterative-build` | Rapid build mode: macOS `.app` only, no dmg. Not a check skip           |
| `pnpm run cli:build`                       | Rollup + TypeScript check (catches type errors Prettier misses)         |
| `pnpm run release:check`                   | The full pre-release gate the `/release` skill requires                 |
| `pnpm run build`                           | Build for current platform                                              |
| `pnpm run build:mac`                       | macOS universal binary                                                  |
| `pnpm run format`                          | Format code (prettier + cargo fmt)                                      |
| `npx vitest run`                           | Unit and integration tests only (sub-second)                            |
| `pnpm test -- --no-build`                  | Full suite minus the multi-arch real build                              |
| `pnpm test`                                | Full suite including release workflow                                   |

## Code Conventions

- No Chinese comments in any source (Rust / TypeScript / any file). Comments and identifiers in English; follow the existing language of surrounding prose.

## Working Principles

- Generated areas (`dist/`, `node_modules/`, `src-tauri/target/`, `.app/`, `src-tauri/icons/`, `src-tauri/png/`) are not source. Exception: `dist/cli.js` is the shipped CLI build artifact (see `package.json` `files`); rebuild it via `pnpm run cli:build` and commit the regenerated file alongside the source change. Two things trigger a rebuild, not one: any change under `bin/`, and **any** change to `package.json`. Rollup inlines the whole manifest, so a dependency bump, a `pnpm.overrides` edit, an `engines` change, or a reworded `description` all leave `dist/cli.js` stale with no `bin/` diff to hint at it. Dependency-only PRs are the usual place this is missed.
- Release status, issue closeout, npm delivery, and GitHub assets are separate truth surfaces. Verify each one live (source commit/tag, workflow run, npm registry, GitHub Release/assets, issue state); never let one passing surface imply another.

## Review Hard Stops

Beyond the rebuild, version-sync, surface, CLI-flag, WebKit, and popup-routing invariants in this file and `.claude/rules/`, a review blocks on:

- npm release workflow changes that drop Trusted Publishing: `.github/workflows/npm-publish.yml`, `id-token: write`, canonical `git+https://github.com/tw93/Pake.git`, and `scripts/check-release-version.mjs` must survive.
- A new helper in `bin/utils/` or `bin/helpers/` without a matching `tests/unit/<basename>.test.ts`.
- A binary parser without a round-trip test.

## Hotspot Map

For proactive latent-bug sweeps, pick one row and go deep; do not invent a whole-repo scope. The third column is **historical failure modes / regression risks**, not a claim that the tree is broken today. Prefer the matching risk areas in `.claude/rules/` invariant when judging a change.

| Hotspot                    | Paths                                  | Regression risk if reintroduced                                                            |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Link / download heuristics | `src-tauri/src/inject/event.js`        | SPA routes or Cmd/Ctrl+click treated as downloads; path roots too broad                    |
| Download success semantics | `invoke.rs`, `window.rs` `on_download` | Non-2xx toasted as success; toast/IPC hardcoded to `"pake"`; request drops session cookies |
| Menu / focused window      | `menu.rs`                              | Commands hit the main window, not the focused one; eval dead on error pages                |
| Startup visibility         | `lib.rs`, `setup.rs`                   | Blank shell, `about:blank` false ready, user hide racing fallback reveal                   |
| Auth / popup               | `auth.js`, `event.js`                  | macOS auth crash, SSO in system browser, Apple popup exception                             |
| Clipboard                  | `event.js`                             | keydown steals native paste; double-paste fallback                                         |
| Multi-window / icon        | `window.rs`, `setup.rs`                | Missing `reapply_window_icon` on show; secondary window toast/target; Cmd+N blank flash    |
| Platform capability        | `auth.rs`, proxy, WebKit flags         | Flag name present, platform no-op                                                          |
| CLI / config contract      | `bin/`, `schema/`                      | Config smuggles out-of-range values CLI rejects                                            |

Oracles per row live under `tests/unit/` (for example `event-link-guard.test.js`, `download-http-status.test.ts`, `menu-focused-window.test.ts`, `startup-window-reveal.test.ts`, `window-icon-reapply.test.ts`); Linux WebKit flag decisions are covered by the `dmabuf_renderer_*` and `legacy_x11_*` `cargo test` cases in `src-tauri/src/lib.rs`.

## risk areas in `.claude/rules/`

- Release state can be split. npm Trusted Publishing can succeed before the popular-app release workflow finishes, and GitHub Release assets can exist while a workflow run still shows queued or in progress. Report each surface explicitly.
- Local app builds and test runs mutate tracked files as build state: `src-tauri/pake.json`, `src-tauri/tauri.conf.json`, `src-tauri/tauri.macos.conf.json`, and regenerated icons under `src-tauri/png/` and `src-tauri/icons/`. Record `git status --short` for these paths before running the command. Afterwards, restore only paths that were clean in that baseline and whose new diff is provably generated by this run. If a path was already dirty or ownership is ambiguous, leave it untouched and rerun verification in an isolated worktree; never let a feature or release commit absorb this churn.
- Incidents are the review eval set. A fix for a defect that reached users through a published npm version or a released app adds its `docs/incidents.md` row in the same commit: the fix commit, the introducing commit when confirmed, the earliest layer that should have caught it, and the test that catches it now. `scripts/check-incidents.mjs` fails a row whose commit does not resolve, whose layer is unknown, or whose catcher is not a test or file in the repository; `tests/unit/check-incidents.test.ts` runs it, so `npx vitest run` in `release:check` and the CI fast suite gate it, and the fast suite's Linux leg checks out full history so commits resolve, while the other legs only shape-check them. Verification follows the paths a change touches, not its author: `node scripts/risk-tier.mjs [paths]` prints, as advice, the extra gates for the publish, public workflow, CI, IPC permission, bundle and CLI artifact tiers, and `--self-check` (locked by `tests/unit/risk-tier.test.ts`) fails when a rename leaves a tier pattern matching no file.

## Where the detail lives

Claude Code loads each `.claude/rules/*.md` when a file matching its `paths:` is read. On another runtime, read the matching file before working there. These stay out of `src-tauri/` because that folder ships in the npm package.

- `.claude/rules/tauri-runtime.md`: native IPC, windows, auth, downloads, WebKit, notifications, shortcuts.
- `.claude/rules/cli.md`: CLI surface, `--json`, build workspaces, caches.
- `.claude/rules/ci.md`: workflows, and which green CI steps are not evidence.
- `.claude/rules/release.md`: read before any release, version bump or tag.

## Platform-Specific Development

### Linux

- Multiple package formats: `.deb`, `.AppImage`, `.rpm`.
- Runtime depends on `libwebkit2gtk` and its companion libraries.
- Icons: `.png`.
- WebKit compositing is platform-sensitive on Wayland; see `.claude/rules/tauri-runtime.md` before changing defaults.
- Maintainer agents verify Linux-only behavior (GNU tools, `cargo test` on Linux cfg paths, `.deb`/AppImage builds, Linux issue repros) on a real Debian x86_64 machine through the private `linux-devbox` skill rather than reasoning from macOS. Contributors without it use any Ubuntu 24.04 machine, matching CI.

## Release Workflow (CI)

### Network Mirror Behavior

Pake uses official npm and Rust sources by default. CN mirrors are explicit opt-in only:

- Set `PAKE_USE_CN_MIRROR=1` only when the user or CI environment intentionally wants npmmirror/rsProxy.
- Do not reintroduce automatic China-domain mirror switching.
- If an install fails against a CN mirror, retry the same install command to separate network availability from a product regression.
- `bin/utils/mirror.ts` and `bin/builders/BaseBuilder.ts` own this behavior; keep docs and tests aligned when changing it.

## Issue Closeout After a Fix

Default loop for a fixed user-reported CLI bug: ship the fix as an npm patch release first, then reply to the reporter with the concrete upgrade command (`npm install -g pake-cli@latest`, or `pake-cli@X.Y.Z` when `latest` may point elsewhere), then close the issue noting it can be reopened if the problem persists. Do not reply "fixed" pointing at an unreleased commit; the npm registry must return the fix version first. The publish itself follows the authorization rule in Release Workflow above.

Keep `closes #N` / `fixes #N` out of commit messages for user-reported bugs. GitHub closes the issue the moment the commit reaches `main`, which is before npm has the fix, so the reporter sees a silent closure while still unable to get it. Reference the issue as a bare `#N` and close it by hand after the registry returns the fix version.

## Community PR Triage

Sort every community PR into one of three outcomes; never rewrite a contribution as a new self-authored PR:

- **Merge as-is**: implementation is sound. Verify locally (build + relevant tests), merge, thank the author.
- **Right direction, implementation needs work**: push fixes directly onto the contributor's branch so their authorship is preserved, then merge and reply summarizing what was changed and why.
- **Out of scope**: close as not planned with a one-line apology and the boundary reason (what Pake deliberately does not do). Keep it friendly and leave room for discussion.

## Troubleshooting

See `docs/faq.md` for common issues and solutions.

### First Tauri build is slow

The first `cargo build` on a fresh clone takes 10+ minutes as Cargo compiles every Tauri dependency from source. Subsequent builds reuse the `src-tauri/target/` cache. This is expected, not a bug.

### macOS SDK / Compile Errors

If compilation errors occur (e.g. on macOS beta), create `src-tauri/.cargo/config.toml`:

```toml
[env]
MACOSX_DEPLOYMENT_TARGET = "15.0"
SDKROOT = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
```

This file is already in `.gitignore`.

### `dist/cli.js` out of sync with its sources

Symptom: tests or release builds use stale CLI behavior after a `bin/` or `package.json` edit. Fix with `pnpm run cli:build` and commit the regenerated `dist/cli.js`. Note `dist/` is gitignored while `dist/cli.js` is tracked, so stage it with `git add -f dist/cli.js`. `quality-and-test.yml` catches this on Linux by failing when `git diff -- dist/` is non-empty after a rebuild, so an unrebuilt artifact fails CI rather than shipping quietly.

## Documentation Guidelines

- **Main README**: keep only common, frequently-used parameters to avoid clutter.
- **CLI Documentation** (`docs/cli-usage.md` and locale variants): include **all** CLI parameters with detailed usage examples.
- **Rare or advanced parameters**: should have full documentation in `docs/cli-usage*.md` but minimal or no mention in the main README. Examples: `--title`, `--incognito`, `--system-tray-icon`, `--multi-window`, `--min-width`, `--min-height`.
- **README popular-packages showcase**: apps render in pairs of `<td>` cells, each with a 600px-wide screenshot from `https://raw.githubusercontent.com/tw93/static/main/pake/<Title>.png` or `.jpg` (the showcase currently mixes both; source spec 2624x1784, a Retina window capture). Upload the screenshot to `tw93/static` before pushing the README row, and note the app's download links stay 404 until the next `V*` release builds its assets.
- **App list curation**: judge showcase or `default_app_list.json` additions and removals with real demand from `gh release view <tag> --json assets` download counts, not intuition. Keep both README locales in the same order.
- **Key configuration files**:
  - `src-tauri/pake.json` - default app configuration (CLI options are merged into it at build time).
  - `src-tauri/tauri.conf.json` - shared Tauri settings.
  - `src-tauri/tauri.{macos,windows,linux}.conf.json` - per-platform overrides.
