# Getting Started

<div align="center">

**English** · [中文](getting-started_CN.md)

</div>

This tutorial takes you from an empty terminal to a desktop app you can open from the Dock or Start menu, then covers the options most people change next. If you would rather not install anything, download a [ready-made app](https://github.com/tw93/Pake/releases/latest) or use the [GitHub Actions online build](github-actions-usage.md) instead.

## Prepare your machine

Pake needs Node.js 20.9 or later and Rust 1.85 or later. Check what you already have:

```bash
node -v
rustc --version
```

If Rust is missing, Pake asks whether to install it on the first build, so you can skip it for now. Each platform also needs its own build tools:

- **macOS**: Xcode Command Line Tools, installed with `xcode-select --install`.
- **Windows**: Visual Studio Build Tools with the C++ workload. Follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) if you have not set them up before.
- **Linux**: the WebKitGTK development packages listed in [Advanced Usage](advanced-usage.md#prerequisites).

## Install the CLI

```bash
pnpm install -g pake-cli
```

`npm install -g pake-cli` works too. If a global install fails with a permission error, run it without installing through `npx pake-cli`, or see the [FAQ](faq.md#permission-denied-when-installing-globally).

## Package your first app

Pass a URL and a name:

```bash
pake https://excalidraw.com --name Excalidraw
```

Pake fetches the site icon, sets up the Rust toolchain if this is the first build, and writes the installer into the current folder: a `.dmg` on macOS, an `.msi` on Windows, and `.deb` plus AppImage on Debian and Ubuntu (`.rpm` plus AppImage on Fedora and other RPM distros). The first build downloads and compiles dependencies, so expect several minutes; later builds take much less.

Open the installer as you would any other app. On macOS you can skip the DMG and install straight into `/Applications` with `--install`.

## Adjust the window

Most apps need only a few more options:

```bash
pake https://excalidraw.com --name Excalidraw --width 1400 --height 900 --hide-title-bar
```

- `--width` and `--height` set the starting window size, 1200 by 780 by default.
- `--hide-title-bar` gives an immersive window on macOS, with the page running up to the top edge.
- `--icon` takes a local or remote image when the site icon looks poor; [macOSicons](https://macosicons.com/#/) is a good source.
- `--show-system-tray` keeps the app in the menu bar or system tray.

Every option, with examples, is in the [CLI reference](cli-usage.md).

## Keep logins and links working

Sites that sign you in through another domain, or open links in new windows, may need one more flag:

- `--safe-domain` lists extra domains that should stay inside the app, such as an SSO provider.
- `--new-window` lets the site open its own pop-up windows, which some OAuth flows need.
- `--multi-window` allows several windows of the same app.

Google and a few other providers block sign-in inside embedded WebViews whatever flags you use. The [FAQ](faq.md#website-features-not-working-login-upload-etc) explains what still works.

## Package a local web build

Pake also packages your own front-end output, so a static site or a tool you built can ship as a desktop app:

```bash
pake ./dist --name MyTool
```

The folder needs an `index.html` at its root. Hash-based routing works; history-mode routing does not.

## Automate it

For scripts and AI agents, add `--json` so stdout carries a single JSON result with stable exit codes, and describe the app in a file with `--config app.json` instead of a long command. The [config](cli-usage.md#config) and [JSON output](cli-usage.md#json) sections cover both, and [llms.txt](../llms.txt) is the contract agents read first.

## Next steps

- [CLI reference](cli-usage.md): every option with examples
- [Advanced Usage](advanced-usage.md): inject CSS and JavaScript, customize further
- [FAQ](faq.md): build and runtime problems by platform
