# Pake AI Agent Documentation

> **READ THIS FIRST**: This file serves as the single source of truth for any AI agent (Claude, Gemini, Cursor, etc.) working on the Pake repository. It aggregates architectural context, development workflows, and behavioral guidelines.

## 1. Philosophy & Guidelines

### Core Philosophy

- **Incremental progress over big bangs**: Break complex tasks into manageable stages.
- **Learn from existing code**: Understand patterns before implementing new features.
- **Clear intent over clever code**: Prioritize readability and maintainability.
- **Simple over complex**: Keep all implementations simple and straightforward - prioritize solving problems and ease of maintenance over complex solutions.

### Eight Honors and Eight Shames

- **Shame** in guessing APIs, **Honor** in careful research.
- **Shame** in vague execution, **Honor** in seeking confirmation.
- **Shame** in assuming business logic, **Honor** in human verification.
- **Shame** in creating interfaces, **Honor** in reusing existing ones.
- **Shame** in skipping validation, **Honor** in proactive testing.
- **Shame** in breaking architecture, **Honor** in following specifications.
- **Shame** in pretending to understand, **Honor** in honest ignorance.
- **Shame** in blind modification, **Honor** in careful refactoring.

### Quality Standards

- **English Only**: usage of Chinese comments is strictly forbidden.
- **No Unnecessary Comments**: For simple, obvious code, let the code speak for itself.
- **Self-Documenting Code**: Prefer explicit types and clear naming over inline documentation.
- **Composition over Inheritance**: Favor functional patterns where applicable (Rust).

## 2. Project Identity

**Name**: Pake
**Purpose**: Turn any webpage into a lightweight desktop app on macOS, Windows, and Linux.
**Core Value**: Significantly smaller (~5MB) and faster than Electron equivalents.
**Mechanism**: Uses Rust and Tauri to wrap web content in a system webview (WebView2 on Windows, WebKit on macOS/Linux).

## 3. Technology Stack

- **Core Framework**: [Tauri v2](https://tauri.app/) (Rust)
- **CLI**: TypeScript, Node.js, Commander.js
- **Frontend**: HTML/CSS/JS (Injected into webviews)
- **Package Manager**: pnpm

## 4. Repository Architecture

### Directory Structure

- **`bin/`**: The CLI tool source code.
  - `cli.ts`: Entry point.
  - `builders/`: Logic for building apps (Mac, Win, Linux).
  - `options/`: CLI argument parsing.
- **`src-tauri/`**: The Main Desktop Application.
  - `src/main.rs`: Entry point, calls `lib.rs`.
  - `src/lib.rs`: **Core Logic**. Menu setup, plugin initialization (`window-state`, `oauth`, `http`, etc.), application lifecycle, and event handling.
  - `src/inject/`: Javascript files injected into the target website.
  - `tauri.conf.json`: Default configuration.
  - `pake.json`: Capabilities config.
- **`dist/`**: Compiled CLI output.

## 5. Key Workflows

### Development

1. **Understand**: Study existing patterns in codebase.
2. **Plan**: Break complex work into stages.
3. **Test**: Write tests first (when applicable).
4. **Implement**: Minimal working solution.
5. **Refactor**: Optimize and clean up.

**Commands**:

- `pnpm i`: Install dependencies.
- `pnpm run cli`: Run CLI in watch mode.
- `pnpm run dev`: Run App in dev mode (hot reload).
- `pnpm test`: Run comprehensive test suite.

### Building

- `pnpm run cli:build`: Build CLI.
- `pnpm run build`: Build App.
- `pnpm run build:debug`: Build App with debug info.

### Release

- CI/CD handles releases via GitHub Actions.
- Versions are managed in `package.json` and `src-tauri/tauri.conf.json`.

## 6. Implementation Details

### CLI (`bin/`)

- Uses `commander` for argument parsing.
- Validates URLs and numbers.
- `BuilderProvider` selects the correct builder based on platform.
- **Key Options**: `--width`, `--height`, `--icon`, `--inject`, `--hide-title-bar`.

### Tauri App (`src-tauri/`)

- **`lib.rs`**: The brain.
  - Sets up the menu (Mac vs others).
  - Configures plugins (`window-state`, `single-instance`, `opener`, etc.).
  - Handles custom commands: `download_file`, `send_notification`.
  - Manages window events (hide on close).
- **Window Management**:
  - Uses `tauri-plugin-window-state` to remember window sizes/positions.
  - Supports "Start to Tray" and "Hide on Close".

### Injection System

- **Path**: `src-tauri/src/inject/`
- **Mechanism**: Tauri injects these scripts at runtime.
- **Functionality**:
  - Custom CSS override.
  - Keyboard shortcuts (Zoom, Navigation).
  - Platform-specific tweaks.

## 7. Common AI Tasks

- **Adding a CLI Option**:
  1. Update `bin/types.ts` (Interface).
  2. Update `bin/defaults.ts` (Default value).
  3. Update `bin/cli.ts` (Commander option).
  4. Update `bin/options/index.ts` (Processing).
  5. Update `src-tauri/src/app/config.rs` (Struct definition) if it needs to pass to Rust.
- **Modifying Menu**: Edit `src-tauri/src/lib.rs` inside `setup` closure.
- **Updating Injected Script**: Edit `src-tauri/src/inject/event.js` or `component.js`.
