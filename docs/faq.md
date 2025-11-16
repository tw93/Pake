# Frequently Asked Questions (FAQ)

<h4 align="right"><strong>English</strong> | <a href="faq_CN.md">简体中文</a></h4>

Common issues and solutions when using Pake.

## Build Issues

### Rust Version Error: "feature 'edition2024' is required"

**Problem:**
When building Pake or using the CLI, you encounter an error like:

```txt
error: failed to parse manifest
Caused by:
  feature `edition2024` is required
  this Cargo does not support nightly features, but if you switch to nightly channel you can add `cargo-features = ["edition2024"]`
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

**Solution 1: Automatic Retry (Built-in)**

Pake CLI now automatically retries with CN mirror if the initial installation times out. Simply wait for the retry to complete.

**Solution 2: Manual Installation**

If automatic retry fails, manually install dependencies:

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

### Linux: AppImage Build Fails with "failed to run linuxdeploy"

**Problem:**
When building AppImage on Linux (Debian, Ubuntu, Arch, etc.), you may encounter errors like:

```txt
Error: failed to run linuxdeploy
Error: strip: Unable to recognise the format of the input file
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

### Windows: Missing Visual Studio Build Tools

**Problem:**
Build fails with errors about missing MSVC or Windows SDK.

**Solution:**

Install Visual Studio Build Tools:

1. Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. During installation, select "Desktop development with C++"
3. For ARM64 support: Also select "MSVC v143 - VS 2022 C++ ARM64 build tools" under Individual Components

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

3. **Check if the site requires specific permissions** that may not be available in WebView

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
