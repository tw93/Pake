# Advanced Usage

<h4 align="right"><strong>English</strong> | <a href="advanced-usage_CN.md">简体中文</a></h4>

Customize Pake apps with style modifications, JavaScript injection, and container communication.

## Style Customization

Remove ads or customize appearance by modifying CSS.

**Quick Process:**

1. Run `pnpm run dev` for development
2. Use DevTools to find elements to modify
3. Edit `src-tauri/src/inject/style.js`:

```javascript
const css = `
  .ads-banner { display: none !important; }
  .header { background: #1a1a1a !important; }
`;
```

## JavaScript Injection

Add custom functionality like keyboard shortcuts.

**Implementation:**

1. Edit `src-tauri/src/inject/event.js`
2. Add event listeners:

```javascript
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "k") {
    // Custom action
  }
});
```

## Built-in Features

### Download Error Notifications

Pake automatically provides user-friendly download error notifications:

**Features:**

- **Bilingual Support**: Automatically detects browser language (Chinese/English)
- **System Notifications**: Uses native OS notifications when permission is granted
- **Graceful Fallback**: Falls back to console logging if notifications are unavailable
- **Comprehensive Coverage**: Handles all download types (HTTP, Data URI, Blob)

**User Experience:**

When a download fails, users will see a notification:

- English: "Download Error - Download failed: filename.pdf"
- Chinese: "下载错误 - 下载失败: filename.pdf"

**Requesting Notification Permission:**

To enable notifications, add this to your injected JavaScript:

```javascript
// Request notification permission on app start
if (window.Notification && Notification.permission === "default") {
  Notification.requestPermission();
}
```

The download system automatically handles:

- Regular HTTP(S) downloads
- Data URI downloads (base64 encoded files)
- Blob URL downloads (dynamically generated files)
- Context menu initiated downloads

## Container Communication

Send messages between web content and Pake container.

**Web Side (JavaScript):**

```javascript
window.__TAURI__.invoke("handle_scroll", {
  scrollY: window.scrollY,
  scrollX: window.scrollX,
});
```

**Container Side (Rust):**

```rust
#[tauri::command]
fn handle_scroll(scroll_y: f64, scroll_x: f64) {
  println!("Scroll: {}, {}", scroll_x, scroll_y);
}
```

## Window Configuration

Configure window properties in `pake.json`:

```json
{
  "windows": {
    "width": 1200,
    "height": 780,
    "fullscreen": false,
    "resizable": true
  },
  "hideTitleBar": true
}
```

## Static File Packaging

Package local HTML/CSS/JS files:

```bash
pake ./my-app/index.html --name my-static-app --use-local-file
```

Requirements: Pake CLI >= 3.0.0

## macOS Media Permissions

By default, apps built with Pake do not request camera or microphone access. For sites that require these (for example, video conferencing or voice input), pass the relevant flags at build time:

```bash
pake https://chatgpt.com --name ChatGPT --microphone
pake https://meet.google.com --name GoogleMeet --camera --microphone
```

- `--microphone` — grants microphone access (`com.apple.security.device.audio-input`)
- `--camera` — grants camera access (`com.apple.security.device.camera`)

macOS will prompt the user for permission on first use. Only add these flags for sites that actually need them.

## Multiple Apps For The Same Site

If you need separate apps for the same site, for example two Gmail accounts with different login state, build them with different app names:

```bash
pake https://gmail.com --name "Gmail Work"
pake https://gmail.com --name "Gmail Personal"
```

Pake now generates a different app identifier for each `URL + name` pair, so these apps can be installed as separate desktop apps instead of resolving to the same app.

For advanced cases, Pake also supports a hidden `--identifier` option if you need to pin the bundle identifier explicitly:

```bash
pake https://gmail.com --name "Gmail Work" --identifier com.example.gmail.work
```

`--multi-instance` is different. It only allows multiple processes for the same packaged app, it does not create separate app identities.

## Project Structure

Understanding Pake's codebase structure will help you navigate and contribute effectively:

```tree
├── bin/                    # CLI source code (TypeScript)
│   ├── builders/          # Platform-specific builders
│   ├── helpers/           # Utility functions
│   └── options/           # CLI option processing
├── docs/                  # Project documentation
├── src-tauri/             # Tauri application core
│   ├── src/
│   │   ├── app/           # Core modules (window, tray, shortcuts)
│   │   ├── inject/        # Web page injection logic
│   │   └── lib.rs         # Application entry point
│   ├── icons/             # macOS icons (.icns)
│   ├── png/               # Windows/Linux icons (.ico, .png)
│   ├── pake.json          # App configuration
│   └── tauri.*.conf.json  # Platform-specific configs
├── scripts/               # Build and utility scripts
└── tests/                 # Test suites
```

### Key Components

- **CLI Tool** (`bin/`): TypeScript-based command interface for packaging apps
- **Tauri App** (`src-tauri/`): Rust-based desktop framework
- **Injection System** (`src-tauri/src/inject/`): Custom CSS/JS injection for webpages
- **Configuration**: Multi-platform app settings and build configurations

## Development Workflow

### Prerequisites

- Node.js ≥22.0.0 (recommended LTS, older versions ≥18.0.0 may work)
- Rust ≥1.85.0 (recommended stable)

#### Platform-Specific Requirements

**macOS:**

- Xcode Command Line Tools: `xcode-select --install`

**Windows:**

- **CRITICAL**: Consult [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) before proceeding
- Windows 10 SDK (10.0.19041.0) and Visual Studio Build Tools 2022 (≥17.2)
- Required redistributables:
  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86) (optional)
  4. Microsoft Visual C++ 2013 Redistributable (x86) (optional)
  5. Microsoft Visual C++ 2008 Redistributable (x86) (optional)

- **Windows ARM (ARM64) support**: Install C++ ARM64 build tools in Visual Studio Installer under "Individual Components" → "MSVC v143 - VS 2022 C++ ARM64 build tools"

**Linux (Ubuntu):**

```bash
sudo apt install libdbus-1-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    gnome-video-effects \
    gnome-video-effects-extra \
    libglib2.0-dev \
    pkg-config
```

### Installation

```bash
# Clone the repository
git clone https://github.com/tw93/Pake.git
cd Pake

# Install dependencies
pnpm install

# Start development
pnpm run dev
```

### Development Commands

1. **CLI Changes**: Edit files in `bin/`, then run `pnpm run cli:build`
2. **Core App Changes**: Edit files in `src-tauri/src/`, then run `pnpm run dev`
3. **Injection Logic**: Modify files in `src-tauri/src/inject/` for web customizations
4. **Testing**: Run `pnpm test` for comprehensive validation

#### Command Reference

- **Dev mode**: `pnpm run dev` (hot reload)
- **Build**: `pnpm run build`
- **Debug build**: `pnpm run build:debug`
- **CLI build**: `pnpm run cli:build`

#### CLI Development

For CLI development with hot reloading, modify the `DEFAULT_DEV_PAKE_OPTIONS` configuration in `bin/defaults.ts`:

```typescript
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & { url: string } = {
  ...DEFAULT_PAKE_OPTIONS,
  url: "https://weekly.tw93.fun/en",
  name: "Weekly",
};
```

Then run:

```bash
pnpm run cli:dev
```

This script reads the configuration and packages the specified app in watch mode, with hot updates for `pake-cli` code changes.

### Testing Guide

Comprehensive CLI build and release validation guidance for multi-platform packaging.

#### Running Tests

```bash
# Complete test suite (recommended)
pnpm test                   # Build the CLI, run the Vitest suite, then run real build + release workflow smoke tests

# Skip the real build and release workflow smoke tests
pnpm test -- --no-build

# Run the fast Vitest suite only
npx vitest run

# Build the CLI explicitly
pnpm run cli:build

# Run the release workflow smoke test directly
node ./tests/release.js
```

#### 🚀 Complete Test Suite Includes

- ✅ **Vitest suite**: unit, integration, builder, and CLI option coverage
- ✅ **Real build smoke test**: platform-aware packaging validation
- ✅ **Release workflow smoke test**: verifies the release build path used for popular apps

#### Test Details

- `pnpm test` runs the main CLI test runner in [`tests/index.js`](../tests/index.js), which:
- builds the CLI,
- runs the Vitest suite,
- runs the real build smoke test unless `--no-build` is passed,
- and then runs the release workflow smoke test when the real build phase succeeds.

Useful optional flags:

- `--no-unit`: skip unit tests
- `--no-integration`: skip integration tests
- `--no-builder`: skip builder tests
- `--no-build`: skip the real build smoke test and the follow-up release workflow smoke test
- `--e2e`: add end-to-end configuration tests
- `--pake-cli`: add GitHub Actions related checks

If you only want the release workflow smoke test, run `node ./tests/release.js` directly.

#### Troubleshooting

- **CLI file not found**: Run `pnpm run cli:build`
- **Test timeout**: Build tests require extended time to complete
- **Build failures**: Check Rust toolchain with `rustup update`
- **Permission errors**: Ensure write permissions are available

### Common Build Issues

- **Rust compilation errors**: Run `cargo clean` in `src-tauri/` directory
- **Node dependency issues**: Delete `node_modules` and run `pnpm install`
- **Permission errors on macOS**: Run `sudo xcode-select --reset`

## Links

- [CLI Documentation](cli-usage.md)
- [GitHub Discussions](https://github.com/tw93/Pake/discussions)
