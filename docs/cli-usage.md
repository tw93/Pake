# CLI Usage Guide

<h4 align="right"><strong>English</strong> | <a href="cli-usage_CN.md">简体中文</a></h4>

Complete command-line reference and basic usage for Pake CLI.

## Installation

Ensure that your Node.js version is 22.0 or higher (e.g., 22.11.0). _Note: Older versions ≥18.0.0 may also work._

**Recommended (pnpm):**

```bash
pnpm install -g pake-cli
```

**Alternative (npm):**

```bash
npm install -g pake-cli
```

**If you encounter permission issues:**

```bash
# Use npx to run without global installation
npx pake-cli [url] [options]

# Or fix npm permissions permanently
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Prerequisites:**

- Node.js ≥18.0.0
- Rust ≥1.78.0 (installed automatically if missing)
- **Windows/Linux**: See [system dependencies guide](advanced-usage.md#prerequisites) for platform-specific requirements

## Quick Start

```bash
# Basic usage - automatically fetches website icon
pake https://github.com --name "GitHub"

# Advanced usage with custom options
pake https://weekly.tw93.fun --name "Weekly" --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800 --hide-title-bar

# Complete example with multiple options
pake https://github.com --name "GitHub Desktop" --width 1400 --height 900 --show-system-tray --debug

```

## CLI Usage

```bash
pake [url] [options]
```

The packaged application will be located in the current working directory by default. The first packaging might take some time due to environment configuration. Please be patient.

> **macOS Output**: On macOS, Pake creates DMG installers by default. To create `.app` bundles for testing (to avoid user interaction), set the environment variable `PAKE_CREATE_APP=1`.
>
> **Note**: Packaging requires the Rust environment. If Rust is not installed, you will be prompted for installation confirmation. In case of installation failure or timeout, you can [install it manually](https://www.rust-lang.org/tools/install).

### [url]

The URL is the link to the web page you want to package or the path to a local HTML file. This is mandatory.

### [options]

Various options are available for customization. Here are the most commonly used ones:

| Option             | Description                                     | Example                                        |
| ------------------ | ----------------------------------------------- | ---------------------------------------------- |
| `--name`           | Application name                                | `--name "Weekly"`                              |
| `--icon`           | Custom icon (optional, auto-fetch website icon) | `--icon https://cdn.tw93.fun/pake/weekly.icns` |
| `--width`          | Window width (default: 1200px)                  | `--width 1400`                                 |
| `--height`         | Window height (default: 780px)                  | `--height 900`                                 |
| `--hide-title-bar` | Immersive header (macOS only)                   | `--hide-title-bar`                             |
| `--debug`          | Enable development tools                        | `--debug`                                      |

For complete options, see detailed sections below.

#### [name]

Specify the application name. If not provided, you will be prompted to enter it. It is recommended to use English.

**Note**: Also supports multiple words with automatic platform-specific handling:

- **Windows/macOS**: Preserves spaces and case (e.g., `"Google Translate"`)
- **Linux**: Converts to lowercase with hyphens (e.g., `"google-translate"`)

```shell
--name <string>
--name MyApp

# Multiple words (if needed):
--name "Google Translate"
```

#### [icon]

**Optional parameter**: If not provided, Pake will automatically fetch the website's icon and convert to the appropriate format. For custom icons, visit [icon-icons](https://icon-icons.com) or [macOSicons](https://macosicons.com/#/).

Supports both local and remote files, automatically converts to platform-specific formats:

- macOS: `.icns` format
- Windows: `.ico` format
- Linux: `.png` format

```shell
--icon <path>

# Examples:
# Without --icon parameter, auto-fetch website icon
pake https://github.com --name GitHub

# With custom icons
--icon ./my-icon.png
--icon https://cdn.tw93.fun/pake/weekly.icns  # Remote icon (.icns for macOS)
```

#### [height]

Set the height of the application window. Default is `780px`.

```shell
--height <number>
```

#### [width]

Set the width of the application window. Default is `1200px`.

```shell
--width <number>
```

#### [hide-title-bar]

Enable or disable immersive header. Default is `false`. Use the following command to enable this feature, macOS only.

```shell
--hide-title-bar
```

#### [fullscreen]

Determine whether the application launches in full screen. Default is `false`. Use the following command to enable full
screen.

```shell
--fullscreen
```

#### [maximize]

Determine whether the application launches with a maximized window. Default is `false`. Use the following command to enable
maximize.

```shell
--maximize
```

#### [activation-shortcut]

Set the activation shortcut for the application. Default is empty, so it does not take effect. You can customize the activation shortcut with the following commands, e.g. `CmdOrControl+Shift+P`. Usage can refer to [available-modifiers](https://www.electronjs.org/docs/latest/api/accelerator#available-modifiers).

```shell
--activation-shortcut <string>
```

#### [always-on-top]

Sets whether the window is always at the top level, defaults to `false`.

```shell
--always-on-top
```

#### [app-version]

Set the version number of the packaged application to be consistent with the naming format of version in package.json, defaulting to `1.0.0`.

```shell
--app-version <string>
```

#### [dark-mode]

Force Mac to package applications using dark mode, default is `false`.

```shell
--dark-mode
```

#### [disabled-web-shortcuts]

Sets whether to disable web shortcuts in the original Pake container, defaults to `false`.

```shell
--disabled-web-shortcuts
```

#### [force-internal-navigation]

Keeps every clicked link (even pointing to other domains) inside the Pake window instead of letting the OS open an external browser or helper. Default is `false`.

```shell
--force-internal-navigation
```

#### [multi-arch]

Package the application to support both Intel and M1 chips, exclusively for macOS. Default is `false`.

##### Prerequisites

- Note: After enabling this option, Rust must be installed using rustup from the official Rust website. Installation via brew is not supported.
- For Intel chip users, install the arm64 cross-platform package to support M1 chips using the following command:

  ```shell
  rustup target add aarch64-apple-darwin
  ```

- For M1 chip users, install the x86 cross-platform package to support Intel chips using the following command:

  ```shell
  rustup target add x86_64-apple-darwin
  ```

##### Usage

```shell
--multi-arch
```

#### [targets]

Specify the build target architecture or format:

- **Linux**: `deb`, `appimage`, `deb-arm64`, `appimage-arm64` (default: `deb`)
- **Windows**: `x64`, `arm64` (auto-detects if not specified)
- **macOS**: `intel`, `apple`, `universal` (auto-detects if not specified)

```shell
--targets <target>

# Examples:
--targets arm64          # Windows ARM64
--targets x64            # Windows x64
--targets universal      # macOS Universal (Intel + Apple Silicon)
--targets apple          # macOS Apple Silicon only
--targets intel          # macOS Intel only
--targets deb            # Linux DEB package (x64)
--targets rpm            # Linux RPM package (x64)
--targets appimage       # Linux AppImage (x64)
--targets deb-arm64      # Linux DEB package (ARM64)
--targets rpm-arm64      # Linux RPM package (ARM64)
--targets appimage-arm64 # Linux AppImage (ARM64)
```

**Note for Linux ARM64**:

- Cross-compilation requires additional setup. Install `gcc-aarch64-linux-gnu` and configure environment variables for cross-compilation.
- ARM64 support enables Pake apps to run on ARM-based Linux devices, including Linux phones (postmarketOS, Ubuntu Touch), Raspberry Pi, and other ARM64 Linux systems.
- Use `--target appimage-arm64` for portable ARM64 applications that work across different ARM64 Linux distributions.

#### [user-agent]

Customize the browser user agent. Default is empty.

```shell
--user-agent <string>
```

#### [show-system-tray]

Display the application in system tray. Default is `false`.

```shell
--show-system-tray
```

#### [system-tray-icon]

Specify the system tray icon. This is only effective when the system tray is enabled. The icon must be in `.ico` or `.png` format and should be an image with dimensions ranging from 32x32 to 256x256 pixels.

```shell
--system-tray-icon <path>
```

#### [hide-on-close]

Hide window instead of closing the application when clicking close button. Platform-specific default: `true` for macOS, `false` for Windows/Linux.

```shell
# Hide on close (default behavior on macOS)
--hide-on-close
--hide-on-close true

# Close application immediately (default behavior on Windows/Linux)
--hide-on-close false
```

#### [start-to-tray]

Start the application minimized to system tray instead of showing the window. Must be used with `--show-system-tray`. Default is `false`.

```shell
--start-to-tray

# Example: Start hidden to tray (must use with --show-system-tray)
pake https://github.com --name GitHub --show-system-tray --start-to-tray
```

**Note**: Double-click the tray icon to show/hide the window. If used without `--show-system-tray`, this option is ignored.

#### [title]

Set the window title bar text. macOS shows no title if not specified; Windows/Linux fallback to app name.

```shell
--title <string>

# Examples:
--title "My Application"
--title "Google Translate"
```

#### [incognito]

Launch the application in incognito/private browsing mode. Default is `false`. When enabled, the webview will run in private mode, which means it won't store cookies, local storage, or browsing history. This is useful for privacy-sensitive applications.

```shell
--incognito
```

#### [wasm]

Enable WebAssembly support with cross-origin isolation headers. Required for Flutter Web applications and other web applications that use WebAssembly modules like `sqlite3.wasm`, `canvaskit.wasm`. Default is `false`.

This option adds necessary HTTP headers (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`) and browser flags to enable SharedArrayBuffer and WebAssembly features.

```shell
--wasm

# Example: Package a Flutter Web app with WASM support
pake https://flutter.dev --name FlutterApp --wasm
```

#### [enable-drag-drop]

Enable native drag and drop functionality within the application. Default is `false`. When enabled, allows drag and drop operations like reordering items, file uploads, and other interactive drag behaviors that work in regular browsers.

```shell
--enable-drag-drop

# Example: Package an app that requires drag-drop functionality
pake https://planka.example.com --name PlankApp --enable-drag-drop
```

#### [keep-binary]

Keep the raw binary file alongside the installer. Default is `false`. When enabled, also outputs a standalone executable that can run without installation.

```shell
--keep-binary

# Example: Package app with both installer and standalone binary
pake https://github.com --name GitHub --keep-binary
```

**Output**: Creates both installer and standalone executable (`AppName-binary` on Unix, `AppName.exe` on Windows).

#### [multi-instance]

Allow the packaged app to run more than one instance at the same time. Default is `false`, which means launching a second instance simply focuses the existing window. Enable this when you need to open several windows of the same app simultaneously.

```shell
--multi-instance

# Example: Allow multiple chat windows
pake https://chat.example.com --name ChatApp --multi-instance
```

#### [installer-language]

Set the Windows Installer language. Options include `zh-CN`, `ja-JP`, More at [Tauri Document](https://tauri.app/distribute/windows-installer/#internationalization). Default is `en-US`.

```shell
--installer-language <language>
```

#### [use-local-file]

Enable recursive copying. When the URL is a local file path, enabling this option will copy the folder containing the file specified in the URL, as well as all sub-files, to the Pake static folder. This is disabled by default.

```shell
--use-local-file

# Basic static file packaging
pake ./my-app/index.html --name "my-app" --use-local-file
```

#### [inject]

Using `inject`, you can inject local absolute and relative path `css` and `js` files into the page you specify the `url` to customize it. For example, an adblock script that can be applied to any web page, or a `css` that optimizes the `UI` of a page, you can write it once to customize it. would only need to write the `app` once to generalize it to any other page.

Supports both comma-separated and multiple option formats:

```shell
# Comma-separated (recommended)
--inject ./tools/style.css,./tools/hotkey.js

# Multiple options
--inject ./tools/style.css --inject ./tools/hotkey.js

# Single file
--inject ./tools/style.css
```

#### [proxy-url]

Set proxy server for all network requests. Supports HTTP, HTTPS, and SOCKS5. Available on Windows and Linux. On macOS, requires macOS 14+.

```shell
--proxy-url http://127.0.0.1:7890
--proxy-url socks5://127.0.0.1:7891
```

#### [debug]

Enable developer tools and detailed logging for debugging.

```shell
--debug
```

### Packaging Complete

After completing the above steps, your application should be successfully packaged. Please note that the packaging process may take some time depending on your system configuration and network conditions. Be patient, and once the packaging is complete, you can find the application installer in the specified directory.

## Docker

```shell
# Run the Pake CLI via Docker (AppImage builds need FUSE access)
docker run --rm --privileged \
    --device /dev/fuse \
    --security-opt apparmor=unconfined \
    -v YOUR_DIR:/output \
    ghcr.io/tw93/pake \
    <arguments>

# For example:
docker run --rm --privileged \
    --device /dev/fuse \
    --security-opt apparmor=unconfined \
    -v ./packages:/output \
    ghcr.io/tw93/pake \
    https://example.com --name myapp --icon ./icon.png --targets appimage
```
