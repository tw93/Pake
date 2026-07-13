# Contributing to WebPake

> Full team division (Chinese): [docs/team-division.md](docs/team-division.md)

## Team Roles

### Member A — Runtime Engine ✅ Done

**Owns:** `crates/runtime/src/app/`, `crates/runtime/src/commands.rs`, `crates/runtime/src/state.rs`

Tasks:
- [x] Window lifecycle (create, resize, maximize, fullscreen)
- [x] Native menu and keyboard shortcuts
- [x] Tauri invoke commands (copy URL, navigate, cache clear)
- [x] Multi-window and incognito mode
- [x] System tray integration

See [member-a-runtime.md](.github/ISSUE_TEMPLATE/member-a-runtime.md) for the Invoke API reference.

### Member B — CLI & Packaging 🔲 In Progress

**Owns:** `crates/cli/`, `crates/packager/`

Tasks:
- [ ] End-to-end packaging: `webpake url --name X` produces installable `.msi` on Windows
- [x] Build progress messages and friendly error output
- [x] CLI flags synced to `docs/cli-usage.md`
- [x] Proper macOS `.icns` generation
- [x] Config file merge via `--config-file`
- [x] Platform config generation (windows/macos/linux)
- [ ] Build cache optimization for repeat builds

### Member C — Platform & Inject & DevOps 🔲 In Progress

**Owns:** `crates/runtime/inject/`, `.github/`, `docs/`, platform tauri configs

Tasks:
- [x] JS inject: clipboard bridge, OAuth popup handling, ad blocking, external links
- [x] Platform-specific tauri configs (macOS/Windows/Linux)
- [x] GitHub Actions release workflow (tag → three-platform artifacts)
- [x] FAQ documentation updated
- [ ] CI verified green on three OS
- [ ] Linux Wayland/WebKit workarounds tested on real hardware

## Milestones

| Phase | Goal | Owner | Status |
|-------|------|-------|--------|
| M0 (Week 1) | Workspace compiles, AppConfig frozen | All | ✅ Done |
| M1 (Week 2-4) | MVP: CLI packages one URL into runnable app | B leads | 🔲 In progress |
| M2 (Week 5-7) | Shortcuts, menu, icon pipeline, inject basics | A + C | A ✅, C ✅ |
| M3 (Week 8-10) | Three-platform installable packages | C leads | 🔲 Pending |
| M4 (Week 11-12) | v0.1.0 release with docs | All | 🔲 Pending |

## Contract Rules

1. **`AppConfig` changes** require all three members to review (in `crates/core`)
2. **New Tauri commands** must be documented in `docs/team-division.md` before C's inject layer uses them
3. **New CLI flags** must update `docs/cli-usage.md` in the same PR
4. No Chinese comments in source code (English only)

## Git Workflow

- `main` branch only
- Feature branches: `feat/a-*`, `feat/b-*`, `feat/c-*`
- PR requires `cargo check --workspace` and `cargo test --workspace` passing
