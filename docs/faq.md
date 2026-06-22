# Frequently Asked Questions (FAQ)

<h4 align="right"><strong>English</strong> | <a href="faq_CN.md">简体中文</a></h4>

Common issues and solutions when using Pake.

## Table of Contents

- [Build Issues](#build-issues)
  - [Rust Version Error: "feature 'edition2024' is required"](#rust-version-error-feature-edition2024-is-required)
  - [Linux: Build Error "Can't detect any appindicator library" on Ubuntu 24.04](#linux-build-error-cant-detect-any-appindicator-library-on-ubuntu-2404)
  - [Linux: AppImage Build Fails with "failed to run linuxdeploy"](#linux-appimage-build-fails-with-failed-to-run-linuxdeploy)
  - [Linux: AppImage Crashes at Launch with WebKitNetworkProcess Not Found](#linux-appimage-crashes-at-launch-with-webkitnetworkprocess-not-found)
  - [Linux: "cargo: command not found" After Installing Rust](#linux-cargo-command-not-found-after-installing-rust)
  - [Windows: Installation Timeout During First Build](#windows-installation-timeout-during-first-build)
  - [Windows: Missing Visual Studio Build Tools](#windows-missing-visual-studio-build-tools)
  - [macOS: Build Fails with Module Compilation Errors](#macos-build-fails-with-module-compilation-errors)
- [Runtime Issues](#runtime-issues)
  - [App Window is Too Small/Large](#app-window-is-too-smalllarge)
  - [App Icon Not Showing Correctly](#app-icon-not-showing-correctly)
  - [Website Features Not Working (Login, Upload, etc.)](#website-features-not-working-login-upload-etc)
- [Installation Issues](#installation-issues)
  - [Permission Denied When Installing Globally](#permission-denied-when-installing-globally)
- [Getting Help](#getting-help)

---

## Build Issues

### Rust Version Error: "feature 'edition2024' is required"

**Problem:**
When building Pake or using the CLI, you encounter an error like:

```txt
error: failed to parse manifest
Caused by:
  feature `edition2024` is required
  this Cargo does not support nightly features, but if you switch to nightly channel you can add `cargo-features = ["edition2024"]
  to enable this feature
```

**Why This Happens:**

Pake's dependencies require Rust edition2024 support, which is only available in Rust 1.85.0 or later. Specifically:

- The dependency chain includes: `tauri` → `image` → `moxcms` → `pxfm v0.1.25` (requires edition2024)
- Rust edition2024 became stable in Rust 1.85.0 (released February 2025)
- If your Rust version is older (e.g., 1.82.0 from August 2024), you'll see this error

**Solution:**

Update your Rust toolchain to version 1.85.0 or later:

```bash
# Update to the latest stable Rust version
rustup update stable

# Or install the latest stable version
rustup install stable

# Verify the update
rustc --version
# Should show: rustc 1.85.0 or higher
```

After updating, retry your build command.

**For Development Setup:**

If you're setting up a development environment, ensure:

- Rust ≥1.85.0 (check with `rustc --version`)
- Node.js ≥22.0.0 (check with `node --version`)

See [CONTRIBUTING.md](../CONTRIBUTING.md) for complete prerequisites.

---

### Linux: Build Error "Can't detect any appindicator library" on Ubuntu 24.04

**Problem:**
When building on Ubuntu 24.04 or newer, you may encounter:

```txt
Can't detect any appindicator library
```

Or potentially errors related to Icon RGBA in older versions.

**Solution:**

Ubuntu 24.04+ replaced `libappindicator3-dev` with `libayatana-appindicator3-dev`.

Install the correct dependency:

```bash
sudo apt-get update
sudo apt-get install -y libayatana-appindicator3-dev
```

---

### Linux: AppImage Build Fails with "failed to run linuxdeploy"

**Problem:**
When building AppImage on Linux (Debian, Ubuntu, Arch, etc.), you may encounter errors like:

```txt
Error: failed to run linuxdeploy
Error: strip: Unable to recognise the format of the input file
ERROR: Failed to run plugin: gtk
cp: cannot stat '/usr/lib/gdk-pixbuf-2.0/2.10.0': No such file or directory
```

**Identify which failure you have first.** Two distinct problems share the `failed to run linuxdeploy` message:

- `strip: Unable to recognise the format of the input file`: a strip incompatibility. Use Solution 1.
- `Failed to run plugin: gtk` together with `cannot stat '/usr/lib/gdk-pixbuf-2.0/...'`: linuxdeploy's gtk plugin cannot find the gdk-pixbuf loaders. `NO_STRIP` will not help. Install the loaders, refresh the cache, then rebuild:

```bash
# Arch
sudo pacman -S gdk-pixbuf2 librsvg
# Debian / Ubuntu
sudo apt install librsvg2-common gdk-pixbuf2.0-bin
# refresh the loader cache, then rebuild
gdk-pixbuf-query-loaders --update-cache
```

**Solution 1: Automatic NO_STRIP Retry (Recommended)**

Pake CLI now automatically retries AppImage builds with `NO_STRIP=1` when linuxdeploy fails to strip the binary. To skip the strip step from the very first attempt (or when scripting your own builds), set the variable manually:

```bash
NO_STRIP=1 pake https://example.com --name MyApp --targets appimage
```

This bypasses the library stripping process that often causes issues on certain Linux distributions.

**Solution 2: Install System Dependencies**

If NO_STRIP doesn't work, ensure you have all required system dependencies:

```bash
sudo apt update
sudo apt install -y \
  libdbus-1-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl wget file \
  libxdo-dev \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  gnome-video-effects \
  libglib2.0-dev \
  libgirepository1.0-dev \
  pkg-config
```

Then try building again (you can still pre-set `NO_STRIP=1` if you prefer).

**Solution 3: Use DEB Format Instead**

DEB packages are more stable on Debian-based systems:

```bash
pake https://example.com --name MyApp --targets deb
```

**Solution 4: Use Docker (with FUSE access)**

Build in a clean environment without installing dependencies. AppImage tooling needs access to `/dev/fuse`, so run the container in privileged mode (or grant FUSE explicitly):

```bash
docker run --rm --privileged \
  --device /dev/fuse \
  --security-opt apparmor=unconfined \
  -v $(pwd)/output:/output \
  ghcr.io/tw93/pake:latest \
  https://example.com --name MyApp --targets appimage
```

> **Tip:** The generated AppImage may be owned by root. Run `sudo chown $(id -nu):$(id -ng) ./output/MyApp.AppImage` afterwards.

**Why This Happens:**

This is a known issue with Tauri's linuxdeploy tool, which can fail when:

- System libraries have incompatible formats for stripping
- Building on newer distributions (Arch, Debian Trixie, etc.)
- Missing WebKit2GTK or GTK development libraries

The `NO_STRIP=1` environment variable is the official workaround recommended by the Tauri community.

---

### Linux: AppImage Crashes at Launch with WebKitNetworkProcess Not Found

**Problem:**
The AppImage builds successfully but crashes immediately at launch:

```txt
** ERROR **: Unable to spawn a new child process: Failed to spawn child process
"././/lib/webkit2gtk-4.1/WebKitNetworkProcess" (No such file or directory)
```

This only affects AppImages built locally on a non-Debian distribution (Arch, Fedora, etc.). Pake's official AppImage releases are built in a Debian-based environment and are not affected.

**Why This Happens:**
This is an upstream Tauri bundler limitation ([tauri-apps/tauri#5292](https://github.com/tauri-apps/tauri/issues/5292)). When bundling, Tauri rewrites the absolute WebKit helper path baked into `libwebkit2gtk*.so` to a relative `././...` form, and copies the helper binaries based on the Debian library layout (`/usr/lib/<arch-triple>/webkit2gtk-4.1`). On Arch the helpers live in `/usr/lib/webkit2gtk-4.1` with no architecture triple, so the patched relative path points at a `lib/webkit2gtk-4.1` directory that does not exist inside the bundle, and `WebKitNetworkProcess` can never be found. Pake does not control this step: the AppDir layout and path patching are produced entirely by `tauri build`.

**Solution 1: Use the Arch native package (recommended on Arch)**

```bash
pake https://example.com --name MyApp --targets zst
```

This produces a pacman package (`*.pkg.tar.zst`) that installs to system paths, so WebKit resolves its helper processes natively and there is no relocation problem. Install it with `sudo pacman -U MyApp-*.pkg.tar.zst`.

**Solution 2: Build the AppImage in Docker (Debian-based)**

Building inside Pake's Docker image matches the library layout the AppImage bundler expects:

```bash
docker run --rm --privileged \
  --device /dev/fuse \
  --security-opt apparmor=unconfined \
  -v $(pwd)/output:/output \
  ghcr.io/tw93/pake:latest \
  https://example.com --name MyApp --targets appimage
```

**Workaround for an already-built AppImage:**
Extract it, add the missing symlink, then launch the inner `AppRun`:

```bash
./MyApp.AppImage --appimage-extract
cd squashfs-root
mkdir -p lib && ln -s ../usr/lib/webkit2gtk-4.1 lib/webkit2gtk-4.1
./AppRun
```

---

### Linux: AppImage Opens but Buttons or Keyboard Do Not Work on Wayland

**Problem:**
On some pure Wayland compositors, especially niri, the AppImage can open but page buttons cannot be clicked or keyboard input does not reach the webview.

**Solution:**
Pake automatically avoids the conservative WebKit rendering flags in niri sessions. To force the same native WebKit path manually, launch the app with:

```bash
PAKE_LINUX_WEBKIT_SAFE_MODE=0 ./MyApp.AppImage
```

If your system shows a blank window instead, re-enable the conservative WebKit workaround:

```bash
PAKE_LINUX_WEBKIT_SAFE_MODE=1 ./MyApp.AppImage
```

**Why This Happens:**
Pake normally enables WebKitGTK workarounds that help blank-window cases on Linux, but those same flags can make input and window controls unreliable on some Wayland compositors. The `PAKE_LINUX_WEBKIT_SAFE_MODE` variable lets you choose the safer rendering mode for your compositor.

---

### Linux: "cargo: command not found" After Installing Rust

**Problem:**
You installed Rust but Pake still reports "cargo: command not found".

**Solution:**

Pake CLI automatically reloads the Rust environment, but if issues persist:

```bash
# Reload environment in current terminal
source ~/.cargo/env

# Or restart your terminal
```

Then try building again.

---

### Windows: Installation Timeout During First Build

**Problem:**
When building for the first time on Windows, you may encounter:

```txt
Error: Command timed out after 900000ms: "cd ... && pnpm install"
```

**Why This Happens:**

First-time installation on Windows can be slow due to:

- Native module compilation (requires Visual Studio Build Tools)
- Large dependency downloads (Tauri, Rust toolchain)
- Windows Defender real-time scanning
- Network connectivity issues

**Solution 1: Enable CN Mirror Explicitly**

Pake CLI uses the official npm and Rust sources by default. If downloads are slow in China, opt in to CN mirrors:

```bash
# macOS/Linux
PAKE_USE_CN_MIRROR=1 pake https://github.com --name GitHub
```

```powershell
# Windows PowerShell
$env:PAKE_USE_CN_MIRROR="1"; pake https://github.com --name GitHub
```

**Solution 2: Manual Installation**

If dependency installation still fails, manually install dependencies:

```bash
# Navigate to pake-cli installation directory
cd %LOCALAPPDATA%\pnpm\global\5\.pnpm\pake-cli@VERSION\node_modules\pake-cli

# Install with CN mirror
pnpm install --registry=https://registry.npmmirror.com

# Then retry your build
pake https://github.com --name GitHub
```

**Solution 3: Improve Network Speed**

- Use a stable network connection
- Temporarily disable antivirus software during installation
- Use a VPN or proxy if needed

**Expected Time:**

- First installation: 10-15 minutes on Windows
- Subsequent builds: Much faster (dependencies cached)

---

### Windows: Missing Visual Studio Build Tools

**Problem:**
Build fails with errors about missing MSVC or Windows SDK.

**Solution:**

Install Visual Studio Build Tools:

1. Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. During installation, select "Desktop development with C++"
3. For ARM64 support: Also select "MSVC v143 - VS 2022 C++ ARM64 build tools" under Individual Components

---

### macOS: Build Fails with Module Compilation Errors

**Problem:**
On macOS 26 Beta or newer, you may see errors related to `CoreFoundation` or `_Builtin_float` modules.

**Solution:**

Create a configuration file to use compatible SDK:

```bash
cat > src-tauri/.cargo/config.toml << 'EOF'
[env]
MACOSX_DEPLOYMENT_TARGET = "15.0"
SDKROOT = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
EOF
```

This file is already in `.gitignore` and won't be committed.

---

## Runtime Issues

### App Window is Too Small/Large

**Solution:**

Specify custom dimensions when building:

```bash
pake https://example.com --width 1200 --height 800
```

See [CLI Usage Guide](cli-usage.md#window-options) for all window options.

---

### App Icon Not Showing Correctly

**Problem:**
Custom icon doesn't appear or shows default icon.

**Solution:**

Ensure you're using the correct icon format for your platform:

- **macOS**: `.icns` format
- **Windows**: `.ico` format
- **Linux**: `.png` format

```bash
# macOS
pake https://example.com --icon ./icon.icns

# Windows
pake https://example.com --icon ./icon.ico

# Linux
pake https://example.com --icon ./icon.png
```

Pake can automatically convert icons, but providing the correct format is more reliable.

---

### Website Features Not Working (Login, Upload, etc.)

**Problem:**
Some website features don't work in the Pake app.

**Solution:**

This is usually due to web compatibility issues. Try:

1. **Set custom User Agent:**

   ```bash
   pake https://example.com --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
   ```

2. **Inject custom JavaScript:**

   ```bash
   pake https://example.com --inject ./fix.js
   ```

   For pages that need periodic reloads, you can keep this behavior in a small injected script instead of adding a dedicated Pake option:

   ```javascript
   function isEditing(element) {
     if (!element) return false;
     const tagName = element.tagName;
     return (
       element.isContentEditable ||
       tagName === "INPUT" ||
       tagName === "TEXTAREA" ||
       tagName === "SELECT"
     );
   }

   setInterval(() => {
     if (!document.hidden && !isEditing(document.activeElement)) {
       window.location.reload();
     }
   }, 300000);
   ```

   Save it as `refresh.js` and package with:

   ```bash
   pake https://news.ycombinator.com --name HackerNews --inject ./refresh.js
   ```

3. **Check if the site requires specific permissions** that may not be available in WebView

4. **Be aware of embedded-webview sign-in limits**

   Some authentication providers, especially Google, may block sign-in inside embedded webviews. Because Pake packages sites into a desktop webview, Google properties or sites that rely on Google OAuth may still fail to sign in even when `--new-window` or `--multi-window` is enabled. This is provider policy, not a packaging bug. In those cases, use the normal browser, a browser-installed app, or a native desktop client.

5. **WeChat Web login environment error**

   WeChat detects the WebView and writes a flag cookie that blocks subsequent logins. Add `--incognito` when packaging to bypass it, at the cost of requiring a QR scan on every launch:

   ```bash
   pake https://wx.qq.com --name WeChat --incognito
   ```

---

## Installation Issues

### Permission Denied When Installing Globally

**Problem:**
`npm install -g pake-cli` fails with permission errors.

**Solution:**

Use one of these approaches:

```bash
# Option 1: Use npx (no installation needed)
npx pake-cli https://example.com

# Option 2: Fix npm permissions
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g pake-cli

# Option 3: Use pnpm (recommended)
pnpm install -g pake-cli
```

---

## Getting Help

If your issue isn't covered here:

1. Check the [CLI Usage Guide](cli-usage.md) for detailed parameter documentation
2. See [Advanced Usage](advanced-usage.md) for prerequisites and system setup
3. Search [existing GitHub issues](https://github.com/tw93/Pake/issues)
4. [Open a new issue](https://github.com/tw93/Pake/issues/new) with:
   - Your OS and version
   - Node.js and Rust versions (`node --version`, `rustc --version`)
   - Complete error message
   - Build command you used
