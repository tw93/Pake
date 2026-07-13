# CLI Usage Guide

> Team division: [team-division.md](team-division.md) (Member B owns CLI docs)

## Installation

```bash
cargo install --path crates/cli
```

Requires `cargo install tauri-cli --version "^2.0"` for full builds.

## Basic Usage

```bash
webpake <URL> --name <APP_NAME>
```

### Examples

```bash
# Package GitHub
webpake https://github.com --name GitHub

# Package with custom window
webpake https://weekly.tw93.fun --name Weekly --width 1200 --height 800

# Custom icon
webpake https://github.com --name GitHub --icon ./my-icon.png

# Frameless window + system tray
webpake https://github.com --name GitHub --hide-title-bar --system-tray

# Multi-window mode
webpake https://github.com --name GitHub --multi-window

# Load defaults from config file
webpake https://github.com --name GitHub --config-file ./my-app.json

# Block ads + custom CSS
webpake https://youtube.com --name YouTube --block-ads --custom-css "body{background:#000}"

# Generate config only (no build)
webpake https://github.com --name GitHub --config-only

# Dev mode
webpake https://github.com --name GitHub --dev
```

## All Options

| Flag | Description | Default |
|------|-------------|---------|
| `<URL>` | Target website URL | required |
| `-n, --name` | Application display name | required |
| `--title` | Custom window title | same as name |
| `--width` | Window width | 1200 |
| `--height` | Window height | 800 |
| `--min-width` | Minimum window width | none |
| `--min-height` | Minimum window height | none |
| `--icon` | Custom icon path (.png/.ico/.icns) | auto-fetch favicon |
| `--hide-title-bar` | Frameless window with drag region | false |
| `--maximize` | Start maximized | false |
| `--incognito` | No persistent storage | false |
| `--multi-window` | Allow multiple windows | false |
| `--user-agent` | Custom user agent string | none |
| `--system-tray` | Show system tray icon | false |
| `--block-ads` | Block common ad selectors | false |
| `--custom-css` | Inject custom CSS | none |
| `--config-file` | Load options from JSON config | none |
| `--open-external-links-in-browser` | Open external links in system browser | true |
| `--no-clipboard-bridge` | Disable clipboard bridge in inject | false |
| `--no-inline-auth` | Disable OAuth popup inlining | false |
| `--target` | Target platform override | host OS |
| `--output-dir` | Output directory for artifacts | bundle dir |
| `--config-only` | Only generate config, skip build | false |
| `--dev` | Run `cargo tauri dev` | false |

## Keyboard Shortcuts (packaged app)

Implemented by Member A. See [team-division.md](team-division.md#快捷键对照表).

| macOS | Windows/Linux | Action |
|-------|---------------|--------|
| ⌘+[ | Ctrl+← | Back |
| ⌘+] | Ctrl+→ | Forward |
| ⌘+R | Ctrl+R | Refresh |
| ⌘+L | Ctrl+L | Copy URL |
| ⌘+- | Ctrl+- | Zoom out |
| ⌘+= | Ctrl+= | Zoom in |
| ⌘+0 | Ctrl+0 | Reset zoom |
| ⌘+Shift+H | Ctrl+Shift+H | Go home |
| ⌘+W | Ctrl+W | Hide window |
| F11 | F11 | Toggle fullscreen |

## Build Output

After a successful build, artifacts are at:

```
crates/runtime/target/release/bundle/
├── msi/          # Windows
├── dmg/          # macOS
└── deb/          # Linux
```

First build compiles all Tauri dependencies (~10 minutes). Subsequent builds are much faster.
