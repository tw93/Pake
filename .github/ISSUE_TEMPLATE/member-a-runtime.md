# Member A — Runtime Engine

> Full spec: [docs/team-division.md](../../docs/team-division.md#成员-a--运行时引擎--已完成)

## Status: ✅ Done

- [x] Window lifecycle: maximize, fullscreen toggle, hide/show, frameless drag region
- [x] Native menu wired to event handlers
- [x] Global keyboard shortcuts (navigation, zoom, refresh, copy URL, devtools, F11)
- [x] Tauri invoke commands: copy URL, navigate home, cache clear, notifications, multi-window, hide, fullscreen
- [x] Multi-window via `open_new_window` command (requires `--multi-window`)
- [x] Incognito mode flag (logged at startup; ephemeral session)
- [x] System tray (`--system-tray`): show/hide/quit + click to restore
- [x] Inject hooks: re-inject script on page load
- [x] Single-instance: focus existing window on second launch

## Files

- `crates/runtime/src/app/` — setup, menu, shortcuts, tray, events, inject
- `crates/runtime/src/commands.rs`
- `crates/runtime/src/state.rs`
- `crates/runtime/src/lib.rs`

## Invoke API (for Member C inject layer)

| Command | Description |
|---------|-------------|
| `get_app_config` | Returns full AppConfig |
| `copy_current_url` | Copy current page URL to clipboard |
| `navigate_home` | Navigate to home URL |
| `clear_cache_and_restart` | Clear cache dir and restart |
| `show_notification` | Native notification |
| `open_new_window` | Open additional window (multi-window mode) |
| `hide_window` | Hide main window |
| `toggle_fullscreen` | Toggle native fullscreen |

## Shortcuts

| Windows/Linux | Action |
|---------------|--------|
| Ctrl+Left/Right | Back / Forward |
| Ctrl+Shift+H | Home |
| Ctrl+R | Refresh |
| Ctrl+L | Copy URL |
| Ctrl+/-/0 | Zoom in/out/reset |
| Ctrl+W | Hide window |
| F11 | Toggle fullscreen |
| Ctrl+Shift+I | DevTools |
