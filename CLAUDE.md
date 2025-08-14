# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Philosophy

- **Incremental progress over big bangs**: Break complex tasks into manageable stages
- **Learn from existing code**: Understand patterns before implementing new features
- **Clear intent over clever code**: Prioritize readability and maintainability

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
npm i

# Development with hot reload
npm run dev

# CLI development
npm run cli:dev

# Production build
npm run build
```

### 3. Testing and Validation

**Key Testing Commands:**

```bash
# Run comprehensive test suite (unit + integration + builder)
npm test

# Build CLI for testing
npm run cli:build

# Debug build for development
npm run build:debug

# Multi-platform testing
npm run build:mac  # macOS universal build
```

**Testing Checklist:**

- [ ] Run `npm test` for comprehensive validation (35 tests)
- [ ] Test on target platforms
- [ ] Verify injection system works
- [ ] Check system tray integration  
- [ ] Validate window behavior
- [ ] Test with weekly.tw93.fun URL
- [ ] Verify remote icon functionality (https://gw.alipayobjects.com/os/k/fw/weekly.icns)

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
npm run dev 2>&1 | grep -i error

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

**Commit Guidelines:**

- Commit working code incrementally
- Use clear, descriptive messages
- Never bypass commit hooks
- Test before committing

## Branch Strategy

- `dev` - Active development, target for PRs
- `main` - Release branch for stable versions

## Prerequisites

- Node.js ≥22.0.0 (recommended LTS, older versions ≥16.0.0 may work)
- Rust ≥1.89.0 (recommended stable, older versions ≥1.78.0 may work)
- Platform build tools (see CONTRIBUTING.md for details)
