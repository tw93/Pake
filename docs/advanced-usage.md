# Advanced Usage

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

- Node.js ≥22.0.0 (recommended LTS, older versions ≥16.0.0 may work)
- Rust ≥1.89.0 (recommended stable, older versions ≥1.78.0 may work)
- Platform-specific build tools:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Visual Studio Build Tools with MSVC
  - **Linux**: `build-essential`, `libwebkit2gtk`, system dependencies

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

- **Dev mode**: `pnpm run dev` (hot reload)
- **Build**: `pnpm run build`
- **Debug build**: `pnpm run build:debug`
- **CLI build**: `pnpm run cli:build`

### Testing

```bash
# Run all tests (unit + integration + builder)
pnpm test

# Build CLI for testing
pnpm run cli:build
```

### Common Build Issues

- **Rust compilation errors**: Run `cargo clean` in `src-tauri/` directory
- **Node dependency issues**: Delete `node_modules` and run `pnpm install`
- **Permission errors on macOS**: Run `sudo xcode-select --reset`

## Links

- [CLI Documentation](cli-usage.md)
- [CLI Testing Guide](cli-testing.md)
- [GitHub Discussions](https://github.com/tw93/Pake/discussions)
