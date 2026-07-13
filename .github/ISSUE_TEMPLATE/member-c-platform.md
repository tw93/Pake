# Member C - Platform & Inject & DevOps

**Status:** 🔲 Pending  
**Full guide:** [docs/team-division.md](../../docs/team-division.md#成员-c--注入层--平台--工程化--待开始)

## This Week (Required)

- [ ] Complete `crates/runtime/inject/bootstrap.js`:
  - Clipboard bridge (Linux/Windows Ctrl+C/V/X/A)
  - OAuth inline popups (Google / Apple / Microsoft)
  - External links → system browser when configured
  - Multi-window link clicks → `open_new_window` invoke
- [ ] Push to GitHub; CI green on Windows / macOS / Linux

## Near-term

- [ ] Platform configs: `tauri.windows.conf.json`, `tauri.macos.conf.json`, `tauri.linux.conf.json`
- [ ] Release workflow: `v*` tag → three-platform GitHub Release assets
- [ ] `--block-ads` tested on YouTube-like pages
- [ ] Linux Wayland workarounds in `docs/faq.md`

## Optional

- [ ] Example apps table in README (GitHub, ChatGPT, etc.)
- [ ] Docker online build
- [ ] 5+ integration tests

## Invoke API (from Member A — use in JS)

| Command | Use case |
|---------|----------|
| `open_new_window` | Multi-window link handling |
| `copy_current_url` | Copy URL from inject layer |

See [member-a-runtime.md](member-a-runtime.md) for full API.

## Files

- `crates/runtime/inject/bootstrap.js`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml` (create)
- `docs/faq.md`
- `docs/cli-usage.md`
