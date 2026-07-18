---
name: pake
description: "Package any website or local web build into a lightweight desktop app using Pake (Tauri/Rust). Use when the user wants to: wrap a URL as a native app, build a desktop app from a website or a local dist/ folder, use Pake CLI to package a page, set up proxy for a packaged app, customize app icons or bundle IDs, or mentions 'pake', 'tauri package', 'website to app', 'wrap site'. Also trigger when the user asks about Pake CLI options, proxy configuration for packaged apps, or icon handling."
version: 2.0.0
allowed-tools:
  - Bash
  - Read
---

# Pake - Website to Desktop App

Pake wraps any webpage or local web build into a native desktop app via Tauri (Rust + system WebView). Output is ~5MB (vs Electron's ~150MB).

## Pick the right command first

- **Inside a Pake repository checkout** (package.json has `"name": "pake-cli"`): build once with `pnpm run cli:build`, then use `node dist/cli.js`.
- **Anywhere else**: use the published CLI. Install with `npm install -g pake-cli` and run `pake`, or run without installing via `npx pake-cli`.

All examples below use `pake`; substitute `node dist/cli.js` inside a checkout.

## Agent Mode (always use this from scripts)

Pass `--json` on every automated run: logs move to stderr and stdout carries exactly one JSON result object.

```bash
pake "https://example.com" --name MyApp --json
# stdout -> {"ok":true,"name":"MyApp","platform":"darwin","arch":"arm64",
#            "outputs":[{"path":"/abs/MyApp.dmg","sizeBytes":5242880,"format":"dmg"}],
#            "warnings":[],"error":null}
```

`--json` (and any non-TTY stdin) disables every interactive prompt.

### Handle results by code, not by scraping text

Exit codes: `0` success, `2` invalid input, `3` build failure, `4` missing environment or dependency setup failure, `1` unexpected. On failure `error` carries `{code, message, hint}`:

| `error.code`    | What to do                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `INVALID_INPUT` | Fix the flag, name, or config field named in `message`; `hint` states the accepted form         |
| `ENV_MISSING`   | Environment setup needed (usually Rust); relay `hint` to the user, or install and rerun         |
| `BUILD_FAILED`  | Rerun once with `--debug` for verbose logs; check platform notes below before changing anything |
| `NETWORK`       | Reserved, not emitted today; network failures arrive as `ENV_MISSING` or `BUILD_FAILED` instead |
| `UNEXPECTED`    | Report the message upstream; do not loop on retries                                             |

On success, report `outputs[].path` to the user; that is the installer/bundle they need. On Linux multi-target builds, `ok: true` can carry fewer outputs than requested formats (failed targets land in `warnings`); check `outputs[].format` before declaring all formats built.

## Declarative config (preferred over long flag lists)

```bash
cat > app.json <<'EOF'
{
  "$schema": "https://raw.githubusercontent.com/tw93/Pake/main/schema/pake.schema.json",
  "url": "https://example.com",
  "name": "MyApp",
  "width": 1280,
  "hideTitleBar": true
}
EOF
pake --config app.json --json
```

Fields are the camelCase CLI option names plus `url`; an explicit CLI flag wins over a config field. Unknown fields and wrong types fail fast with `INVALID_INPUT`.

For the full option list, run `pake --help` or read the schema above. Do not guess option names; the schema is the source of truth. Complete reference: https://github.com/tw93/Pake/blob/main/docs/cli-usage.md

## Local content (AI-generated apps)

Pake packages local web artifacts, not just URLs:

```bash
# A directory of static files (must contain index.html at its root)
pake ./dist --name MyTool --json

# A single HTML file
pake ./page.html --name MyPage --json
```

Hash-based routing works out of the box; history-mode SPA routing is not yet supported for local packaging.

## Workflow

### 1. Gather requirements

Confirm with the user before building:

| Parameter                  | Why it matters                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| URL or local path          | The target website or build output                                                                                |
| Name                       | Becomes the `.app` / `.exe` name and productName                                                                  |
| Bundle ID (`--identifier`) | Defaults to `com.pake.a{md5hash}`; set explicitly for clean installs (e.g. `com.pake.youtube`)                    |
| Proxy (`--proxy-url`)      | Baked into the binary at build time; not runtime-configurable. Format: `http://host:port` or `socks5://host:port` |
| Icon                       | Auto-fetched from website if omitted; can be a local path or URL                                                  |

### 2. Handle icons

Pake auto-fetches icons from multiple services (logo.dev, brandfetch, clearbit, Google favicons, direct favicon.ico). However:

**The icon download does NOT use `--proxy-url`.** That flag only configures the packaged app's WebView proxy. If the icon URL requires a proxy to reach (e.g. Google/GitHub assets from China), download it manually first:

```bash
curl -x http://<proxy-host>:<proxy-port> -o /tmp/icon.png "<icon-url>" --connect-timeout 15 -s
pake "<URL>" --icon /tmp/icon.png --json
```

Icon tips:

- Prefer 256x256 or larger PNGs; SVG also works
- Pake auto-converts to platform format: `.icns` (macOS), `.ico` (Windows), `.png` (Linux)
- macOS icons get a squircle mask automatically
- Inside a repo checkout, an old `src-tauri/icons/<name>.icns` is reused; rename or remove it to force re-fetch

### 3. Build and verify

Build takes ~40s with cache, ~2min cold; the very first build on a fresh machine compiles Tauri dependencies and can take 10+ minutes. After a successful build:

- Report the artifact path from `outputs[].path`
- Ask the user to open the app and check the icon
- Bundle ID check: `mdls -name kMDItemCFBundleIdentifier <path-to>.app` (macOS)

## Platform notes

### Proxy support

| Platform | Status    | Notes                                                                |
| -------- | --------- | -------------------------------------------------------------------- |
| Windows  | Full      | Via `--proxy-server` browser arg                                     |
| Linux    | Full      | Via `--proxy-server` browser arg                                     |
| macOS    | macOS 14+ | Uses Tauri native `macos-proxy` feature; auto-detected at build time |

### Chrome extensions

Not supported. Pake uses the system WebView (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux), not a full Chrome browser. Use `--inject` to add custom JS/CSS as an alternative.

### OAuth-dependent sites

`--new-window` allows popup auth windows and `--safe-domain` keeps SSO callbacks in-app, but some providers (especially Google) block sign-in inside embedded webviews regardless of flags. Warn the user before promising OAuth support.

### Linux Wayland input issues

If an AppImage opens but clicks or keyboard input do not reach the page on a pure Wayland compositor (especially niri), first rebuild with the latest `pake-cli`, then try the native WebKit path:

```bash
PAKE_LINUX_WEBKIT_SAFE_MODE=0 ./YourApp.AppImage
```

If that produces a blank window on the same system, re-enable the conservative workaround with `PAKE_LINUX_WEBKIT_SAFE_MODE=1`. Do not diagnose this from GTK, appindicator, or GStreamer warnings alone; those are often unrelated optional runtime warnings.
