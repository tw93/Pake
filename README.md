# WebPake

**Turn any webpage into a lightweight desktop app with one command.**

Inspired by [Pake](https://github.com/tw93/Pake), rebuilt as a **pure Rust** Cargo workspace with Tauri v2.

## Features

- Lightweight: uses system WebView (WebKit / WebView2)
- One-command packaging via Rust CLI
- Cross-platform: macOS, Windows, Linux
- Customizable: icons, window size, title bar, CSS injection, ad blocking

## Quick Start

### Prerequisites

- Rust >= 1.85
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS
- `cargo install tauri-cli` (for build/dev commands)

### Install CLI

```bash
git clone https://github.com/qiuxh016/Pake.git
cd webpake
cargo install --path crates/cli
```

### Package a website

```bash
# Basic usage
webpake https://github.com --name GitHub

# With custom options
webpake https://chat.openai.com --name ChatGPT --width 1200 --height 800 --hide-title-bar

# Dev mode (hot reload)
webpake https://github.com --name GitHub --dev

# Generate config only (no build)
webpake https://github.com --name GitHub --config-only
```

## Project Structure

```
webpake/
├── crates/
│   ├── core/       # Shared AppConfig contract (all members)
│   ├── cli/        # CLI entry point (Member B)
│   ├── packager/   # Icon + config + build pipeline (Member B)
│   └── runtime/    # Tauri desktop app (Member A + C)
├── crates/assets/  # Frontend placeholder
├── templates/      # Default config templates
├── docs/           # Documentation (Member C)
│   ├── team-division.md  # 三人分工详情
│   ├── cli-usage.md
│   └── faq.md
└── .github/        # CI/CD (Member C)
```

## Team Division

Three-person team building a [Pake](https://github.com/tw93/Pake)-style desktop packager in Rust.

| Member | Responsibility | Paths | Status |
|--------|---------------|-------|--------|
| **A** | Runtime: window, menu, shortcuts, Tauri commands | `crates/runtime/src/app/`, `commands.rs` | ✅ Done |
| **B** | CLI + packaging pipeline | `crates/cli/`, `crates/packager/` | 🔲 In progress |
| **C** | Inject layer, platform quirks, CI, docs | `crates/runtime/inject/`, `.github/`, `docs/` | 🔲 In progress |

**Full division of labor (tasks, milestones, APIs, weekly checklist):** [docs/team-division.md](docs/team-division.md)

See also [CONTRIBUTING.md](CONTRIBUTING.md) for Git workflow and contract rules.

## Development

```bash
# Check entire workspace
cargo check --workspace

# Run tests
cargo test --workspace

# Dev mode for runtime
cd crates/runtime && cargo tauri dev

# Package via CLI
cargo run -p webpake-cli -- https://example.com --name Example --config-only
```

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--name` | App display name | required |
| `--title` | Window title | same as name |
| `--width` | Window width | 1200 |
| `--height` | Window height | 800 |
| `--icon` | Custom icon path | auto-fetch favicon |
| `--hide-title-bar` | Frameless window | false |
| `--maximize` | Start maximized | false |
| `--incognito` | No persistent storage | false |
| `--block-ads` | Block common ad selectors | false |
| `--custom-css` | Inject custom CSS | none |
| `--dev` | Run tauri dev instead of build | false |
| `--config-only` | Only generate config | false |

Full docs: [docs/cli-usage.md](docs/cli-usage.md)

## License

MIT
