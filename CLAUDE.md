# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Philosophy

- **Incremental progress over big bangs**: Break complex tasks into manageable stages
- **Learn from existing code**: Understand patterns before implementing new features
- **Clear intent over clever code**: Prioritize readability and maintainability
- **Simple over complex**: Keep all implementations simple and straightforward - prioritize solving problems and ease of maintenance over complex solutions

## Project Overview

Pake transforms any webpage into a lightweight desktop app using Rust and Tauri. It's significantly lighter than Electron (~5M vs ~100M+) with better performance.

**Core Architecture:**

- **CLI Tool** (`bin/`): TypeScript-based command interface
- **Tauri App** (`src-tauri/`): Rust desktop framework
- **Injection System**: Custom CSS/JS injection for webpages

## Development Workflow

### 1. Planning Phase

Break complex work into 3-5 stages:

1. Understand existing patterns in codebase
2. Plan implementation approach
3. Write tests first (when applicable)
4. Implement minimal working solution
5. Refactor and optimize

### 2. Implementation Flow

**Understanding First:**

```bash
# Explore codebase structure
find src-tauri/src -name "*.rs" | head -10
grep -r "window_config" src-tauri/src/
```

**Development Commands:**

```bash
# Install dependencies
pnpm i

# Development with hot reload (for testing app functionality)
pnpm run dev

# CLI development
pnpm run cli:dev

# Production build
pnpm run build
```

### 3. Testing and Validation

**Key Testing Commands:**

```bash
# Run comprehensive test suite (unit + integration + builder)
pnpm test

# Build CLI for testing
pnpm run cli:build

# Debug build for development
pnpm run build:debug

# Multi-platform testing
pnpm run build:mac  # macOS universal build
```

**Testing Checklist:**

- [ ] Run `npm test` for comprehensive validation (35 tests)
- [ ] Test on target platforms
- [ ] Verify injection system works
- [ ] Check system tray integration
- [ ] Validate window behavior
- [ ] Test with weekly.tw93.fun URL
- [ ] Verify remote icon functionality (https://cdn.tw93.fun/pake/weekly.icns)

**Testing Notes:**

- Do NOT use `PAKE_NO_CONFIG_OVERWRITE=1` - this environment variable is not implemented
- For CLI testing: `node dist/cli.js https://example.com --name TestApp --debug`
- **For app functionality testing**: Use `pnpm run dev` to start development server with hot reload. This allows real-time testing of injected JavaScript changes without rebuilding the entire app.
- The dev server automatically reloads when you modify files in `src-tauri/src/inject/` directory

## Core Components

### CLI Tool (`bin/`)

- `bin/cli.ts` - Main entry point with Commander.js
- `bin/builders/` - Platform-specific builders (Mac, Windows, Linux)
- `bin/options/` - CLI option processing and validation
- `bin/helpers/merge.ts` - Configuration merging (name setting at line 55)

### Tauri Application (`src-tauri/`)

- `src/lib.rs` - Application entry point
- `src/app/` - Core modules (window, tray, shortcuts)
- `src/inject/` - Web page injection logic

## Documentation Guidelines

- **Main README**: Only include common, frequently-used parameters to avoid clutter
- **CLI Documentation** (`docs/cli-usage.md`): Include ALL parameters with detailed usage examples
- **Rare/Advanced Parameters**: Should have full documentation in CLI docs but minimal/no mention in main README
- **Examples of rare parameters**: `--title`, `--incognito`, `--system-tray-icon`, etc.

### Key Configuration Files

- `pake.json` - App configuration
- `tauri.conf.json` - Tauri settings
- Platform configs: `tauri.{macos,windows,linux}.conf.json`

## Problem-Solving Approach

**When stuck:**

1. **Limit attempts to 3** before stopping to reassess
2. **Document what doesn't work** and why
3. **Research alternative approaches** in similar projects
4. **Question assumptions** - is there a simpler way?

**Example debugging flow:**

```bash
# 1. Check logs
pnpm run dev 2>&1 | grep -i error

# 2. Verify dependencies
cargo check --manifest-path=src-tauri/Cargo.toml

# 3. Test minimal reproduction
# Create simple test case isolating the issue
```

## Platform-Specific Development

### macOS

- Universal builds: `--multi-arch` flag
- Uses `.icns` icons
- Title bar customization available

### Windows

- Requires Visual Studio Build Tools
- Uses `.ico` icons
- MSI installer support

### Linux

- Multiple formats: deb, AppImage, rpm
- Requires `libwebkit2gtk` and dependencies
- Uses `.png` icons

## Quality Standards

**Code Standards:**

- Prefer composition over inheritance
- Use explicit types over implicit
- Write self-documenting code
- Follow existing patterns consistently

**Git and Commit Guidelines:**

- **NEVER commit code automatically** - User handles all git operations
- **NEVER generate commit messages** - User writes their own commit messages
- **NEVER run npm publish automatically** - Always remind user to run it manually
- **NEVER execute git tag or push operations** - User handles all tag creation and GitHub pushes
- Only make code changes, user decides when and how to commit
- Test before user commits

## Branch Strategy

- `dev` - Active development, target for PRs
- `main` - Release branch for stable versions

## Prerequisites

- Node.js ≥22.0.0 (recommended LTS, older versions ≥18.0.0 may work)
- Rust ≥1.89.0 (recommended stable, older versions ≥1.78.0 may work)
- Platform build tools (see CONTRIBUTING.md for details)
