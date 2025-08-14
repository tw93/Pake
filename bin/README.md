<h4 align="right"><strong>English</strong> | <a href="https://github.com/tw93/Pake/blob/main/bin/README_CN.md">简体中文</a></h4>

## Installation

Ensure that your Node.js version is 22.0 or higher (e.g., 22.11.0). _Note: Older versions ≥16.0.0 may also work._ Avoid using `sudo` for the installation. If you encounter permission issues with npm, refer to [How to fix npm throwing error without sudo](https://stackoverflow.com/questions/16151018/how-to-fix-npm-throwing-error-without-sudo).

```bash
npm install pake-cli -g
```

<details>
<summary><strong>Considerations for Windows & Linux Users</strong></summary>

- **CRITICAL**: Consult [Tauri prerequisites](https://tauri.app/start/prerequisites/) before proceeding.
- For Windows users (ensure that `Win10 SDK (10.0.19041.0)` and `Visual Studio build tool 2022 (>=17.2)` are installed), additional installations are required:
  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86) (optional)
  4. Microsoft Visual C++ 2013 Redistributable (x86) (optional)
  5. Microsoft Visual C++ 2008 Redistributable (x86) (optional)

- For Ubuntu users, execute the following commands to install the required libraries before compiling:

  ```bash
  sudo apt install libdbus-1-dev \
      libsoup-3.0-dev \
      libjavascriptcoregtk-4.1-dev \
      libwebkit2gtk-4.1-dev \
      build-essential \
      curl \
      wget \
      libssl-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      gnome-video-effects \
      gnome-video-effects-extra
  ```

</details>

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

Various options are available for customization. You can pass corresponding arguments during packaging to achieve the desired configuration.

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

Specify the application icon. Supports both local and remote files. By default, it uses the Pake brand icon. For custom icons, visit [icon icons](https://icon-icons.com) or [macOSicons](https://macosicons.com/#/).

- For macOS, use `.icns` format.
- For Windows, use `.ico` format.
- For Linux, use `.png` format.

```shell
--icon <path>
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

#### [activation-shortcut]

Set the activation shortcut for the application. Default is ` `, it does not take effect, you can customize the activation shortcut with the following commands, e.g. `CmdOrControl+Shift+P`, use can refer to [available-modifiers](https://www.electronjs.org/docs/latest/api/accelerator#available-modifiers).

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

Choose the output package format, supporting `deb`, `appimage`, `rpm`, This option is only applicable to Linux and defaults to `deb`.

```shell
--targets <format>
```

#### [user-agent]

Customize the browser user agent. Default is empty.

```shell
--user-agent <string>
```

#### [show-system-tray]

Display the system tray. Default is not to display. Use the following command to enable the system tray.

```shell
--show-system-tray
```

#### [system-tray-icon]

Specify the system tray icon. This is only effective when the system tray is enabled. The icon must be in `.ico` or `.png` format and should be an image with dimensions ranging from 32x32 to 256x256 pixels.

```shell
--system-tray-icon <path>
```

#### [hide-on-close]

Hide the window instead of exiting when clicking the close button. Default is `true`. When enabled, the application will be minimized to the system tray (if available) or hidden when the close button is clicked, rather than actually closing the application.

```shell
--hide-on-close
```

#### [title]

Set the window title bar text. If not specified, the window title will be empty.

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

#### [installer-language]

Set the Windows Installer language. Options include `zh-CN`, `ja-JP`, More at [Tauri Document](https://tauri.app/distribute/windows-installer/#internationalization). Default is `en-US`.

```shell
--installer-language <language>
```

#### [use-local-file]

Enable recursive copying. When the URL is a local file path, enabling this option will copy the folder containing the file specified in the URL, as well as all sub-files, to the Pake static folder. This is disabled by default.

```shell
--use-local-file
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

The typed package has dev-tools for debugging, in addition to outputting more log messages for debugging.

```shell
--debug
```

### Wait a moment

After completing the above steps, your application should be successfully packaged. Please note that the packaging process may take some time depending on your system configuration and network conditions. Be patient, and once the packaging is complete, you can find the application installer in the specified directory.

## Development

The `DEFAULT_DEV_PAKE_OPTIONS` configuration in `bin/defaults.ts` can be modified at development time to match the `pake-cli` configuration description.

```typescript
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & { url: string } = {
  ...DEFAULT_PAKE_OPTIONS,
  url: "https://weekly.tw93.fun/",
  name: "Weekly",
};
```

then

```bash
npm run cli:dev
```

The script will read the above configuration and packages the specified `app` using `watch` mode, and changes to the `pake-cli` code and `pake` are hot updated in real time.

## Docker

```shell
# On Linux, you can run the Pake CLI via Docker
docker run -it --rm \ # Run interactively, remove container after exit
    -v YOUR_DIR:/output \ # Files from container's /output will be in YOU_DIR
    ghcr.io/tw93/pake \
    <arguments>

# For example:
docker run -it --rm \
    -v ./packages:/output \
    ghcr.io/tw93/pake \
    https://example.com --name myapp --icon ./icon.png

```
