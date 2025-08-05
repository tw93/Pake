# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pake is a tool that turns any webpage into a desktop app with Rust, using Tauri framework. It's much lighter than Electron (~5M vs ~100M+) and provides better performance. The project consists of a CLI tool for packaging web apps and the core Tauri application framework.

## Commands

### Development

```bash
# Install dependencies
npm i

# Local development (right-click to open debug mode)
npm run dev

# CLI development with hot reload
npm run cli:dev

# Build CLI tools
npm run cli:build
```

### Building

```bash
# Production build
npm run build

# Debug build
npm run build:debug

# Mac universal build (Intel + M1)
npm run build:mac

# Generate app configuration
npm run build:config
```

### CLI Usage

```bash
# Install CLI globally
npm install -g pake-cli

# Package a webpage
pake https://example.com --name MyApp --width 1200 --height 800

# Development with custom options
# Modify DEFAULT_DEV_PAKE_OPTIONS in bin/defaults.ts
npm run cli:dev
```

### Analysis

```bash
# Analyze binary size
npm run analyze
```

## Architecture

### Core Components

1. **CLI Tool** (`bin/`): Node.js/TypeScript-based command-line interface

   - `bin/cli.ts` - Main CLI entry point with Commander.js
   - `bin/builders/` - Platform-specific builders (Mac, Windows, Linux)
   - `bin/options/` - CLI option processing and validation
   - `bin/utils/` - Utility functions for URL validation, platform detection

2. **Tauri Application** (`src-tauri/`): Rust-based desktop app framework

   - `src-tauri/src/lib.rs` - Main application entry point
   - `src-tauri/src/app/` - Application modules (config, window, system tray, shortcuts)
   - `src-tauri/src/inject/` - JavaScript/CSS injection for web pages
   - `src-tauri/pake.json` - Default app configuration

3. **Build System**: Uses Rollup for CLI bundling and Tauri for app packaging

### Configuration System

- **pake.json**: Main configuration file defining window properties, user agents, system tray settings
- **tauri.conf.json**: Tauri-specific configuration
- Platform-specific configs: `tauri.macos.conf.json`, `tauri.windows.conf.json`, `tauri.linux.conf.json`

### Key Features Implementation

- **Window Management**: `src-tauri/src/app/window.rs` - Window creation, sizing, title bar handling
- **System Tray**: `src-tauri/src/app/setup.rs` - Cross-platform system tray integration
- **Global Shortcuts**: Activation shortcuts for bringing app to foreground
- **Web Integration**: Custom user agents, proxy support, CSS/JS injection
- **Multi-platform**: Builds for macOS (Intel/M1), Windows, Linux (deb/appimage/rpm)

## File Injection System

The project supports injecting custom CSS/JS files into webpages:

- Files in `src-tauri/src/inject/` contain the injection logic
- Use `--inject` CLI option to specify custom files
- Supports both local and remote injection files

## Platform-Specific Notes

### macOS

- Supports universal builds (Intel + M1) with `--multi-arch`
- Hide title bar option available with `--hide-title-bar`
- Uses `.icns` icons

### Windows

- Requires specific build tools and redistributables (see bin/README.md)
- Uses `.ico` icons
- Supports installer language configuration

### Linux

- Multiple package formats: deb, appimage, rpm
- Requires specific system dependencies (libwebkit2gtk, etc.)
- Uses `.png` icons

## Development Workflow

1. **CLI Development**: Modify `bin/defaults.ts` for default options, use `npm run cli:dev` for hot reload
2. **Core App Development**: Work in `src-tauri/src/`, use `npm run dev` for Tauri development
3. **Testing**: Build with `--debug` flag for development tools and verbose logging
4. **Multi-platform**: Test builds on respective platforms or use GitHub Actions

## Branch Management

- `dev` branch: Active development, feature PRs should target this branch
- `main` branch: Release branch for tags and publishing

## Prerequisites

- Node.js >=16.0.0
- Rust >=1.78.0 (installed automatically by CLI if missing)
- Platform-specific build tools (see Tauri prerequisites)
