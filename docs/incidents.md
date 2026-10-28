# Incidents

Defects that reached a user through a published npm version or a released app, kept as the eval set for every review layer ("incidents are the eval", from the Claude Code team's code review write-up). A row is added in the same change that fixes the defect: the fix commit, the commit that introduced it when known, the earliest layer that should have caught it, and the test or gate that catches it now. `scripts/check-incidents.mjs` fails a row whose commit does not resolve, whose layer is not one of the names below, or whose catcher is not defined in the code; `tests/unit/check-incidents.test.ts` runs it, so `npx vitest run` in `pnpm run release:check` and the CI fast suite fail on a broken row.

A catcher is written in backticks and is one of: the exact title of a Vitest or `node:test` case under `tests/` or `bin/`, a Rust `#[test]` function under `src-tauri/src`, or the repository path of a test file or gate script (for example `tests/browser/fullscreen.mjs`). A title that holds a `|` or a backtick cannot sit in this table; rename the test.

Layers, earliest first:

- `write-time`: the author's own check before committing, a sweep of same-shape sites.
- `unit`: `npx vitest run` and `cargo test --lib`.
- `cli-build`: `pnpm run cli:build` (Rollup plus the TypeScript check).
- `ci`: the Quality & Testing workflow (`Run Fast Test Suite`, `Rust Code Quality`, `Full Tauri Build`, Docker packaging).
- `review`: a diff review against the Review Hard Stops and Current Risk Areas in `AGENTS.md`.
- `release-check`: `pnpm run release:check` and the release workflows before a tag.
- `native`: a real build run on the affected OS or WebView (the `tests/integration` and `tests/browser` probes, a bundled app).
- `field`: only a real user's machine, desktop environment or input method shows it.

When a review skill, its prompt or the model running it changes, rerun it on the files each fix touched as they were at `<Fixed>^` and record which rows it finds. `Introduced` is a commit only when it was confirmed by reading the history, otherwise `unknown`.

## Incidents

| ID   | Reported   | Symptom                                                                                                                                                            | Introduced | Fixed    | Layer  | Caught by                                                                                                                                 |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| I-01 | 2026-06-29 | `--zoom 99.5` passed the CLI range check and produced a `pake.json` the app could not load (#1274); the same value later still passed through `--config`           | unknown    | 7edf2af4 | unit   | `rejects malformed zoom values instead of truncating them`, `rejects fractional zoom like the --zoom flag`                                |
| I-02 | 2026-07-13 | Apps started at login on Windows showed a blank taskbar icon (#1323)                                                                                               | unknown    | 83a1c476 | field  | `reapplies the icon after every explicit window show`, `targets the large taskbar icon instead of only the small window icon`             |
| I-03 | 2026-08-01 | A SPA link under `/assets/` was intercepted as a download and a 403 response was toasted as a successful download (#1339)                                          | unknown    | f61b3267 | unit   | `navigates SPA routes under /assets/ instead of treating them as downloads`, `rejects non-success HTTP responses before writing the file` |
| I-04 | 2026-08-08 | On Windows a window hidden with `--hide-on-close` could never be restored from the tray (#1343)                                                                    | unknown    | 4ba7e65d | native | `acts on one edge of the click, not both`, `treats a minimized window as not on screen`                                                   |
| I-05 | 2026-08-10 | Apps built with `--new-window` aborted (SIGABRT) on Cmd+click or `target=_blank` links on macOS 26 (#1347)                                                         | unknown    | 71dccbb5 | native | `uses WebKit's target configuration with a fresh user content controller`                                                                 |
| I-06 | 2026-09-10 | Fullscreen video on Windows lost its captions, progress bar and player controls (#1373)                                                                            | unknown    | f671ded1 | native | `preserves WebView2 native fullscreen and keeps the other platform polyfill`, `tests/browser/fullscreen.mjs`                              |
| I-07 | 2026-09-20 | Playing a video crashed apps on Wayland with WebKitGTK 2.52 after the 3.17.1 fix had covered only X11 (#1386, #1374)                                               | unknown    | 3c978e1e | field  | `modern_wayland_uses_shm_instead_of_disabling_compositing`, `shm_preserves_legacy_webkit_niri_and_explicit_modes`                         |
| I-08 | 2026-09-25 | `window.print()` failed with "webview.print not allowed" because the capability lacked the print permission (#1396)                                                | unknown    | 187cabb1 | review | `window_print_reaches_the_webview_only_from_trusted_contexts`                                                                             |
| I-09 | 2026-09-28 | `--windows-toolchain gnu --keep-binary` left a raw `.exe` that would not start without `WebView2Loader.dll` beside it (#1402)                                      | 1fe55a88   | 3e906e81 | unit   | `copies WebView2Loader.dll beside the raw binary for gnu`, `records the DLL as an artifact after the binary with --keep-binary`           |
| I-10 | 2026-10-15 | On macOS the Enter that confirms a Chinese input method candidate reached the page and sent the message early (#1415)                                              | unknown    | f4b4e3cb | field  | `keeps the candidate-confirming Enter (keyCode 229) away from the page`                                                                   |
| I-11 | 2026-10-28 | After one failed Windows build, every later build refused to start with "A previous Pake process left a compilation cache lock" until the lock was deleted by hand | 5d66c330   | 16d79b66 | native | `a failed Windows build whose taskkill exits %i keeps the workspace %i times`                                                             |
