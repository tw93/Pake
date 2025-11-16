## How to contribute to Pake

**Welcome to create [pull requests](https://github.com/tw93/Pake/compare/) for bugfix, new component, doc, example, suggestion and anything.**

## Branch Management

```mermaid
graph LR
    b_dev(dev) --> b_main(main);
    contributions([Develop / Pull requests]) -.-> b_dev;
```

- `dev` branch
  - `dev` is the developing branch.
  - It's **RECOMMENDED** to commit feature PR to `dev`.
- `main` branch
  - `main` is the release branch, we will make tag and publish version on this branch.
  - If it is a document modification, it can be submitted to this branch.

## Development Setup

### Prerequisites

- Node.js ≥22.0.0 (recommended LTS, older versions ≥16.0.0 may work)
- Rust ≥1.85.0 (required for edition2024 support in dependencies)
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

### Testing

```bash
# Run all tests (unit + integration + builder)
pnpm test

# Build CLI for testing
pnpm run cli:build
```

## Continuous Integration

The project uses streamlined GitHub Actions workflows:

- **Quality & Testing**: Automatic code quality checks and comprehensive testing on all platforms
- **Claude AI Integration**: Automated code review and interactive assistance
- **Release Management**: Coordinated releases with app building and Docker publishing

## Troubleshooting

### macOS 26 Beta Compilation Issues

If you're running macOS 26 Beta and encounter compilation errors related to `mac-notification-sys` or system frameworks (errors about `CoreFoundation`, `_Builtin_float` modules), create a `src-tauri/.cargo/config.toml` file with:

```toml
[env]
# Fix for macOS 26 Beta compatibility issues
# Forces use of compatible SDK when building on macOS 26 Beta
MACOSX_DEPLOYMENT_TARGET = "15.0"
SDKROOT = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
```

This file is already in `.gitignore` and should not be committed to the repository.

**Root Cause**: macOS 26 Beta uses newer system frameworks that aren't yet fully compatible with Tauri's dependencies. This configuration uses the universal SDK symlink which automatically points to your system's available SDK version.

### Common Build Issues

- **Rust compilation errors**: Run `cargo clean` in `src-tauri/` directory
- **`cargo` command not found after installation**: Pake CLI now reloads the Rust environment automatically, but if the issue persists reopen your terminal or run `source ~/.cargo/env` (macOS/Linux) / `call %USERPROFILE%\.cargo\env` (Windows) before retrying
- **Node dependency issues**: Delete `node_modules` and run `pnpm install`
- **Permission errors on macOS**: Run `sudo xcode-select --reset`

See the [Advanced Usage Guide](docs/advanced-usage.md) for project structure and customization techniques.

## More

It is a good habit to create a feature request issue to discuss whether the feature is necessary before you implement it. However, it's unnecessary to create an issue to claim that you found a typo or improved the readability of documentation, just create a pull request.
