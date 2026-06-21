---
name: use-pake
description: "Package any website into a lightweight desktop app using Pake (Tauri/Rust). Use when the user wants to: wrap a URL as a native app, build a desktop app from a website, use Pake CLI to package a page, set up proxy for a packaged app, customize app icons or bundle IDs, or mentions 'pake', 'tauri package', 'website to app', 'wrap site'. Also trigger when the user asks about Pake CLI options, proxy configuration for packaged apps, or icon handling."
version: 1.0.0
allowed-tools:
  - Bash
  - Read
---

# Pake - Website to Desktop App

Pake wraps any webpage into a native desktop app via Tauri (Rust + system WebView). Output is ~5MB (vs Electron's ~150MB). Run the commands below from the root of this Pake repository.

## Quick Start

```bash
# Build the CLI once (produces dist/cli.js); skip if dist/ already exists
pnpm run cli:build

node dist/cli.js "<URL>" --name <AppName> [options]
```

## Workflow

### 1. Gather Requirements

Before running the build, confirm these with the user:

| Parameter                  | Why it matters                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| URL                        | The target website                                                                                                |
| Name                       | Becomes the `.app` / `.exe` name and productName                                                                  |
| Bundle ID (`--identifier`) | Defaults to `com.pake.a{md5hash}` — set explicitly for clean installs (e.g. `com.pake.youtube`)                   |
| Proxy (`--proxy-url`)      | Baked into the binary at build time; not runtime-configurable. Format: `http://host:port` or `socks5://host:port` |
| Icon                       | Auto-fetched from website if omitted; can be a local path or URL                                                  |

### 2. Handle Icons

Pake auto-fetches icons from multiple services (logo.dev, brandfetch, clearbit, Google favicons, direct favicon.ico). However:

**The icon download does NOT use `--proxy-url`.** That flag only configures the packaged app's WebView proxy. If the icon URL requires a proxy to reach (e.g. Google/GitHub assets from China), download it manually first:

```bash
curl -x http://<proxy-host>:<proxy-port> -o /tmp/icon.png "<icon-url>" --connect-timeout 15 -s
```

Then pass the local file:

```bash
node dist/cli.js "<URL>" --icon /tmp/icon.png ...
```

**Icon tips:**

- Prefer 256x256 or larger PNGs; SVG also works
- Pake auto-converts to platform format: `.icns` (macOS), `.ico` (Windows), `.png` (Linux)
- macOS icons get a squircle mask automatically
- If an old icon exists in `src-tauri/icons/<name>.icns`, Pake reuses it — rename/remove it to force re-fetch

### 3. Build

```bash
node dist/cli.js "<URL>" \
  --name <AppName> \
  --identifier <com.pake.xxx> \
  --proxy-url "http://host:port" \
  --icon /path/to/icon.png
```

Build takes ~40s with cache, ~2min cold. Output: `<AppName>.dmg` in the project root.

### 4. Verify

After build, confirm:

- DMG path printed in output
- Icon correctness (user should open and check)
- Bundle ID via: `mdls -name kMDItemCFBundleIdentifier <path-to>.app`

## CLI Options Reference

### Common Options

| Option                   | Default            | Description                       |
| ------------------------ | ------------------ | --------------------------------- |
| `--name <string>`        | —                  | App name                          |
| `--icon <string>`        | auto-fetch         | Icon path (local file or URL)     |
| `--identifier <string>`  | `com.pake.a{hash}` | Bundle ID / app identifier        |
| `--proxy-url <url>`      | —                  | WebView proxy (http/https/socks5) |
| `--width <number>`       | 1200               | Window width                      |
| `--height <number>`      | 780                | Window height                     |
| `--app-version <string>` | 1.0.0              | App version                       |

### Window Behavior

| Option             | Default | Description          |
| ------------------ | ------- | -------------------- |
| `--fullscreen`     | false   | Start fullscreen     |
| `--maximize`       | false   | Start maximized      |
| `--always-on-top`  | false   | Pin window on top    |
| `--hide-title-bar` | false   | Hide macOS title bar |

### Advanced

| Option                        | Default | Description                                  |
| ----------------------------- | ------- | -------------------------------------------- |
| `--inject <files>`            | —       | Inject CSS/JS files (comma-separated paths)  |
| `--user-agent <string>`       | —       | Custom user agent                            |
| `--debug`                     | false   | Enable devtools and verbose logging          |
| `--multi-arch`                | false   | Build for both Intel and Apple Silicon       |
| `--multi-instance`            | false   | Allow multiple app instances                 |
| `--multi-window`              | false   | Multiple windows in one instance             |
| `--new-window`                | false   | Allow popup windows (needed for OAuth flows) |
| `--safe-domain <domains>`     | none    | Keep trusted SSO/workspace domains in-app    |
| `--incognito`                 | false   | Private browsing mode                        |
| `--dark-mode`                 | false   | Force macOS dark mode                        |
| `--zoom <number>`             | 100     | Initial zoom level (50-200)                  |
| `--wasm`                      | false   | Enable WebAssembly                           |
| `--enable-drag-drop`          | false   | Drag & drop support                          |
| `--camera`                    | false   | Camera permission (macOS)                    |
| `--microphone`                | false   | Microphone permission (macOS)                |
| `--ignore-certificate-errors` | false   | Ignore TLS errors                            |
| `--targets <string>`          | auto    | Build target format                          |
| `--use-local-file`            | false   | Package local HTML file                      |

## Platform Notes

### Proxy Support

| Platform | Status    | Notes                                                                |
| -------- | --------- | -------------------------------------------------------------------- |
| Windows  | Full      | Via `--proxy-server` browser arg                                     |
| Linux    | Full      | Via `--proxy-server` browser arg                                     |
| macOS    | macOS 14+ | Uses Tauri native `macos-proxy` feature; auto-detected at build time |

### Chrome Extensions

Not supported. Pake uses system WebView (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux), not a full Chrome browser. Use `--inject` to add custom JS/CSS as an alternative.

### Linux Wayland Input Issues

If an AppImage opens but buttons cannot be clicked or keyboard input does not reach the page on a pure Wayland compositor, especially niri, first rebuild with the latest `pake-cli`. Then try the native WebKit path:

```bash
PAKE_LINUX_WEBKIT_SAFE_MODE=0 ./YourApp.AppImage
```

If that produces a blank window on the same system, re-enable the conservative WebKit workaround:

```bash
PAKE_LINUX_WEBKIT_SAFE_MODE=1 ./YourApp.AppImage
```

Do not diagnose this from GTK, appindicator, or GStreamer warnings alone; those can be optional runtime warnings unrelated to the input failure.

## Common Patterns

### Website behind proxy (icon also needs proxy)

```bash
# Step 1: Download icon via proxy
curl -x http://127.0.0.1:7890 -o /tmp/icon.png "<icon-url>" -s

# Step 2: Build with local icon
node dist/cli.js "https://example.com" \
  --name MyApp \
  --identifier com.pake.myapp \
  --proxy-url "http://127.0.0.1:7890" \
  --icon /tmp/icon.png
```

### Force icon re-fetch

```bash
# Remove cached icon, then build without --icon
mv src-tauri/icons/<name>.icns src-tauri/icons/<name>.icns.bak
node dist/cli.js "https://example.com" --name MyApp
```

### OAuth-dependent site

```bash
node dist/cli.js "https://accounts.google.com" \
  --name GoogleApp \
  --new-window \
  --ignore-certificate-errors
```
