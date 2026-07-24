# Pake Rust + Tauri Rules

> Pake-specific Rust + Tauri rules. Standard Rust hygiene is assumed: `?` over `unwrap()`, `cargo clippy` clean, `cargo fmt` before commit. The `dist/cli.js` rebuild rule and CN mirror policy live in AGENTS.md (Current Risk Areas / Network Mirror Behavior) and are not repeated here.

## Pake-Specific

### Error handling

- No `panic!` / `.unwrap()` / `.expect()` on user-reachable paths: CLI options, config loading, event handlers, IPC commands. Use `?` and surface clear messages.
- Silent `catch {}` in TS or `let _ = ...` in Rust must surface the real error through `logger.warn` at minimum. Note `logger.warn` also feeds the `--json` warnings array; status lines belong in `logger.info`.
- Predictable CLI failures throw `PakeError` with `{code, hint}` (`bin/utils/error.ts`); the code maps to a stable exit code and the `--json` error object. Plain `Error` gets classified by build phase in `bin/cli.ts`.
- In machine mode (`--json`) stdout is reserved for the single JSON result. Never `console.log` / `process.stdout.write` in `bin/`; subprocess stdout is rerouted to stderr by `shellExec`.
- `shellExec` runs subprocesses with `stdio: 'inherit'`, so their output (linuxdeploy, cargo, npm) never reaches `error.message`; only the failed command line does. Do NOT classify a build failure by grepping `error.message`; you would be matching the command, not the diagnostics. Drive failure guidance off a structured fact the caller holds (e.g. `target === 'appimage'`). Owners: `bin/utils/shell.ts` + `bin/builders/BaseBuilder.ts`.

### Config types

- No `tauriConf: any` or other untyped config bags. Use `PakeTauriConfig`.
- Window options live in `bin/helpers/cli-program.ts`, `bin/types.ts`, `bin/defaults.ts`, `bin/helpers/merge.ts`. Adding an option means touching all four plus `schema/pake.schema.json` and `docs/cli-usage*.md`. Forgetting any is a regression; the schema half is caught by `tests/unit/config-file.test.ts`.

### Tauri trust boundary

- Packaged remote pages are untrusted. Validate semantic bounds for every `#[tauri::command]` input, keep remote capabilities limited to the exact operations required, and keep long-running IPC asynchronous so page code cannot block the app loop.

### Platform sensitivity

- WebKit compositing on Linux/Wayland is platform-sensitive. Don't change defaults without testing on the affected platform or documenting the risk.
- Linux WebKit runtime flags live in `src-tauri/src/lib.rs`. Keep the default conservative; compositor-specific exceptions need unit tests for the decision function and FAQ guidance for users.
- AppImage logs often contain optional GTK, appindicator, or GStreamer warnings. Do not treat those warnings as the root cause unless the user-visible symptom and target path confirm it.
- `--incognito` trades persistence for clean private sessions; be deliberate around login / cookies / local storage / embedded-WebView detection.
- Google OAuth and other embedded-WebView restrictions may still apply even with `--new-window` / `--multi-window`.
