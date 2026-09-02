---
name: bugs
version: 1.0.0
description: Proactively sweep a Pake area for latent UX and runtime defects before users report them, using this repo's own fix history and boundary archetypes, and confirm every finding with a probe run this turn. Use for 找找有没有bug, 主动找bug, 有没有隐患, 排查隐患, 举一反三, 上线前扫一遍, 这块可靠吗, latent bug scan, sibling sweep after a fix. Not for an already-reported symptom (that is /hunt) and not for reviewing a diff (that is /check). Named bugs, not bug: /bug is a Claude Code built-in.
---

# Bugs: Find It Before the User Does

`/hunt` needs a symptom. `/check` needs a diff. This one needs neither: it goes looking.

## The Question

Across Pake's fix history the dominant defect is not a crash. It is a wrong-but-plausible behavior: a SPA route treated as a download, a menu command aimed at the wrong window, a blank shell shown before the page is ready, or a flag that is a no-op on one platform. Nothing panics; the user just gets a worse desktop app than the browser.

So the question that finds bugs here is never "can this crash?" It is:

> What does this code do when the page is an **SPA route**, the window is **not the main label**, the document is an **error/blank shell**, the click has a **modifier key**, or the platform **ignores the Chromium flag**?

Aim it at a boundary, not at a file.

## 1. Pick the surface

Name the area and the depth. A whole-repo sweep with no budget produces speculation; pick one hotspot and go deep. Start from the Hotspot Map in `AGENTS.md` (Current Risk Areas + table below) rather than inventing a scope.

| Hotspot                    | Primary paths                                            | Locked tests (examples)                                                           |
| -------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Link / download heuristics | `src-tauri/src/inject/event.js`                          | `event-link-guard.test.js`, `download-http-status.test.ts`                        |
| Download success semantics | `src-tauri/src/app/invoke.rs`, `window.rs` `on_download` | `download-http-status.test.ts`                                                    |
| Menu / focused window      | `src-tauri/src/app/menu.rs`                              | `menu-focused-window.test.ts`                                                     |
| Startup visibility         | `src-tauri/src/lib.rs`, `setup.rs`                       | `startup-window-reveal.test.ts`                                                   |
| Auth / popup               | `inject/auth.js`, `inject/event.js`                      | `auth-sso-patterns.test.js`, `new-window-macos.test.js`                           |
| Clipboard                  | `inject/event.js`                                        | `event-clipboard-shortcuts.test.js`                                               |
| Multi-window / icon        | `window.rs`, `setup.rs`                                  | `window-icon-reapply.test.ts`, `startup-window-reveal.test.ts`                    |
| Platform fake capability   | `auth.rs`, proxy, WebKit flags in `lib.rs`               | `macos-proxy-feature.test.ts`, `lib.rs` `linux_webkit_safe_mode_*` (`cargo test`) |
| CLI / config contract      | `bin/`, `schema/pake.schema.json`                        | `config-file.test.ts`, `cli-options.test.ts`                                      |

The AGENTS.md Hotspot Map third column is regression risk, not an open-bug list. Confirm against Current Risk Areas and the tests above before treating a row as a live defect.

## 2. Read the area's own fix history first

```bash
git log --oneline --grep='^fix' -i -- <path>
git log --pretty=format:'%h %s%n%b' --grep='^fix' -i -- <path> | head -200
```

Bugs recur by shape within a module. Two signals worth acting on:

- A fix chain of three or more commits each "completing" the previous one means a fourth sibling is probably still out there. Real chains here: download path heuristics (`/releases/`, then `/assets/`, then the next SPA root), startup reveal (blank, then about:blank, then user cancel), menu target (`"pake"` hardcode, then focused window, then remaining hardcodes).
- A commit body that says the prior fix was incomplete means that pattern's grep was under-run once already. Re-run it.

## 3. Sweep the boundaries, in this order

Highest historical yield first. For each, read the matching Risk Areas note in `AGENTS.md` before hypothesizing.

| Boundary                         | What to ask                                                                                                                               | Where it lives                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Download / navigation heuristics | Would a SPA route under this path/extension be intercepted? Prefer extension + `download` attr + query hints over broad path roots.       | `inject/event.js`                               |
| Success vs transport             | Is HTTP non-2xx, empty body, or missing file still toasted as success?                                                                    | `invoke.rs`, `on_download`                      |
| Window identity                  | Does this path hardcode `"pake"` when the user may be on `pake-N` or the focused window?                                                  | `menu.rs`, `invoke.rs`, `setup.rs`, `window.rs` |
| Eval on dead pages               | Does this menu/shortcut need a page JS context? Error and blank shells have none; prefer native `reload` / `navigate` / platform history. | `menu.rs`                                       |
| Startup vs user control          | Can page-load or fallback re-show a window the user already hid? Latch every user visibility path.                                        | `lib.rs`, `setup.rs`                            |
| Auth / popup                     | Does macOS auth still crash, strand about:blank, or open the system browser for SSO? Apple Sign-In stays native popup.                    | `auth.js`, `event.js`                           |
| Clipboard                        | Does keydown steal native paste (images/files)? Is fallback gated on trusted keyup + TTL?                                                 | `event.js`                                      |
| Platform capability              | Is this flag real on WKWebView / WebView2 / WebKitGTK, or a Chromium-only no-op?                                                          | `auth.rs`, `window.rs`, `lib.rs`                |
| Config dual track                | Can a config file smuggle a value the CLI flag rejects?                                                                                   | `bin/helpers/merge.ts`, schema                  |

For generic shapes (fail-open guards, recovery gated on the artifact it restores, watchdog tuned only to the fast path), use `/hunt` and load its `references/failure-patterns.md` catalog. Do not re-derive that catalog here.

## 4. Confirm before reporting

A candidate is not a finding until it has evidence produced **this turn**.

- **Confirmed**: a probe, a failing unit test on current code, or a complete source trace with a named trigger.
- **Plausible**: the failure path is named, but nothing was run. Report separately and name the probe that would settle it.
- **Not a finding**: anything inferred from a function name or "this looks risky". Grep the implementation or drop it.

Oracles that settle cases here: unit tests under `tests/unit/`, `cargo test` for pure Rust helpers, a real packaged app cold start for blank-window claims, and the public site in a browser for "does this path navigate or download".

Before flagging any risky-looking call, confirm it is production code. Unwraps in `#[test]`, string literals, and build scripts are not defects.

## 5. Rank by blast radius

1. Silently wrong navigation or download the user acts on (SPA route stolen, auth stranded)
2. Stuck state with no recovery (error page, dead menu, latched hide)
3. Multi-window / wrong-target action
4. Wrong but visible (toast on wrong window, blank flash)
5. Cosmetic

## 6. Guard what gets fixed

Anything confirmed and fixed needs a test that fails on the unfixed code, usually under `tests/unit/`. For a class of bug, guard the pattern (source introspection, parity, or pure helper), not only one URL string.

Verify with:

```bash
npx vitest run
cargo test
cargo clippy --all-targets -- -D warnings
```

When the change touches `bin/`, also `pnpm run cli:build` and stage regenerated `dist/cli.js`.

## Hard Rules

- **No finding without this-turn evidence.** Speculation dressed as a finding wastes more review time than it saves.
- **One archetype hit means sweep the whole repo for its signature.** Grep the shape, not the literal text, and report "checked N sites, M defective, K not applicable".
- **Do not fix while sweeping.** Collect, then fix. Interleaving loses the sweep.
- **Report clean boundaries as clean.** A boundary that was checked and holds is a result. Do not manufacture findings to justify the run.
- **Findings outside the named area get listed, not fixed**, unless the maintainer agrees.

## Output

```
Area:        [what was swept, at what depth]
Boundaries:  [N walked, M applicable]

Confirmed (severity order):
1. [file:line] [the defect in one sentence]
   Evidence: [probe output / failing test / measurement]
   Blast:    [what the user sees]

Plausible (needs a probe):
1. [file:line] [defect] -> [the probe that would settle it]

Swept clean:
- [boundary]: [what was checked, why it holds]

Sibling sweep: [pattern signature] -> [N checked, M defective, K n/a]
```

Say whether anything was fixed or whether this was scan-only.
