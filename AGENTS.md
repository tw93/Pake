# AGENTS.md - Pake Project Knowledge Base

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

Keep shared project facts in this file so Codex, Claude Code, and other agents use the same public source of truth. Tool-specific local skills or overrides must remain optional and ignored.

## Task Intake And Investigation

Prefer requests with:

- `Goal`: exact bug, feature, refactor, or review target
- `Scope`: files, directories, or subsystem boundaries to inspect first
- `Repro`: command, input, fixture, or failing test
- `Expected`: expected behavior
- `Actual`: current behavior, error text, or regression note
- `Constraints`: what must not change
- `Verify`: minimum command or test that proves the result

When task scope is incomplete, inspect in this order:

1. CLI entry and option parsing under `bin/cli.ts`, `bin/options/`, and `bin/helpers/`
2. Target TypeScript module under `bin/`
3. Tauri runtime or packaging files under `src-tauri/src/` and `src-tauri/tauri*.conf.json`
4. Narrow tests under `tests/unit/` or `tests/integration/`
5. Release workflow files under `.github/workflows/` only for CI or release issues
6. Docs only if behavior, ownership, or expected usage is still unclear

Execution rules:

- Start with the smallest plausible file set
- Prefer targeted search (`rg <symbol|string> <paths>`) over repository-wide scans
- Ignore generated or output-heavy areas unless the task directly targets them, especially `dist/`, `node_modules/`, `src-tauri/target/`, `.app/`, `src-tauri/icons/`, and `src-tauri/png/`. Exception: `dist/cli.js` is the shipped CLI build artifact (see `package.json` `files`); when you change anything under `bin/`, rebuild it via `pnpm run cli:build` and commit the regenerated `dist/cli.js` alongside the source change
- Keep changes local to one subsystem when possible
- Run the narrowest relevant verification first, expand only if needed
- If key context is missing, make one reasonable assumption and proceed

## Current Risk Areas

- CLI options are user-facing and must stay synchronized across `bin/helpers/cli-program.ts`, `bin/types.ts`, `bin/defaults.ts`, `bin/helpers/merge.ts`, generated `dist/cli.js`, and `docs/cli-usage*.md`.
- Recent window/runtime options include `--incognito`, `--new-window`, `--min-width`, `--min-height`, `--maximize`, multi-window behavior, notification click handling, and Linux/Wayland WebKit compositing defaults.
- `--incognito` intentionally trades persistence for clean private sessions; be careful around login, cookies, local storage, and WeChat-style WebView detection.
- `--new-window` and `--multi-window` do not bypass every provider policy. Google OAuth and similar embedded-WebView restrictions may still require a normal browser or native client.
- Notification flows cross injected JS, Tauri invokes, capabilities, and native notification plugins. Verify the Rust capability and JS caller together.
- WebKit compositing behavior is platform-sensitive on Linux/Wayland. Do not change defaults without testing the affected platform path or documenting the risk.

## Code Quality Standards

- Chinese comments are forbidden.

## Branch Strategy

- `main` - Only branch. All development and releases happen here directly.

## Version Management

Three files must be updated in sync for every release:

| File                        | Field                       |
| --------------------------- | --------------------------- |
| `package.json`              | `"version"`                 |
| `src-tauri/Cargo.toml`      | `version` under `[package]` |
| `src-tauri/tauri.conf.json` | `"version"`                 |

Tag format: `V0.x.x` (uppercase V). Current version: check `package.json`.

## Release Workflow (CI)

Pushing a `V*` tag triggers `.github/workflows/release.yml`:

1. **release-apps** - reads `default_app_list.json` for app list
2. **create-release** - creates the GitHub Release placeholder
3. **build-cli** - builds and uploads the `dist/` CLI artifact
4. **build-popular-apps** - builds all apps in parallel across macOS/Windows/Linux
5. **publish-docker** - builds and pushes Docker image to GHCR

The workflow can also be triggered manually via `workflow_dispatch` with options to build popular apps or publish Docker independently.

After tagging, npm publish is done manually: `npm publish`.

`.github/workflows/quality-and-test.yml` runs auto-format on push, Rust quality checks, and CLI/build validation across Linux, Windows, and macOS.

### Network Mirror Behavior

Pake uses official npm and Rust sources by default. CN mirrors are explicit opt-in only:

- Set `PAKE_USE_CN_MIRROR=1` only when the user or CI environment intentionally wants npmmirror/rsProxy.
- Do not reintroduce automatic China-domain mirror switching.
- If an install fails against a CN mirror, retry the same install command to separate network availability from a product regression.
- `bin/utils/mirror.ts` and `bin/builders/BaseBuilder.ts` own this behavior; keep docs and tests aligned when changing it.

## CLI Usage Example

```bash
# Install CLI
pnpm install -g pake-cli

# Basic usage
pake https://github.com --name GitHub

# Advanced usage
pake https://weekly.tw93.fun --name Weekly --width 1200 --height 800
```

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

Symptom: tests or release builds use stale CLI behavior after a `bin/` edit. Fix with `pnpm run cli:build` and commit the regenerated `dist/cli.js`.

### First Tauri build is slow

The first `cargo build` on a fresh clone takes 10+ minutes as Cargo compiles every Tauri dependency from source. Subsequent builds reuse the `src-tauri/target/` cache. This is expected, not a bug.
