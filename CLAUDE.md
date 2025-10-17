# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Philosophy

- **Incremental progress over big bangs**: Break complex tasks into manageable stages
- **Learn from existing code**: Understand patterns before implementing new features
- **Clear intent over clever code**: Prioritize readability and maintainability
- **Simple over complex**: Keep all implementations simple and straightforward - prioritize solving problems and ease of maintenance over complex solutions

## Claude Code Eight Honors and Eight Shames

- **Shame** in guessing APIs, **Honor** in careful research
- **Shame** in vague execution, **Honor** in seeking confirmation
- **Shame** in assuming business logic, **Honor** in human verification
- **Shame** in creating interfaces, **Honor** in reusing existing ones
- **Shame** in skipping validation, **Honor** in proactive testing
- **Shame** in breaking architecture, **Honor** in following specifications
- **Shame** in pretending to understand, **Honor** in honest ignorance
- **Shame** in blind modification, **Honor** in careful refactoring

## Project Overview

Pake transforms any webpage into a lightweight desktop app using Rust and Tauri. It's significantly lighter than Electron (~5M vs ~100M+) with better performance.

**Core Architecture:**

- **CLI Tool** (`bin/`): TypeScript-based command interface
- **Tauri App** (`src-tauri/`): Rust desktop framework
- **Injection System**: Custom CSS/JS injection for webpages

## Development Workflow

1. **Understand**: Study existing patterns in codebase
2. **Plan**: Break complex work into 3-5 stages
3. **Test**: Write tests first (when applicable)
4. **Implement**: Minimal working solution
5. **Refactor**: Optimize and clean up

**Key Commands:**

```bash
pnpm test           # Run comprehensive test suite
pnpm run cli:build  # Build CLI for testing
pnpm run dev        # Development with hot reload
```

**Testing:**

- Always run `pnpm test` before committing
- For CLI testing: `node dist/cli.js https://example.com --name TestApp --debug`
- For app functionality testing: Use `pnpm run dev` for hot reload

## Core Components

- **CLI Tool** (`bin/`): Main entry point, builders, options processing
- **Tauri App** (`src-tauri/`): Rust application, window/tray management, injection logic
- **Config Files**: `pake.json`, `tauri.conf.json`, platform-specific configs
- **Injection System** (`src-tauri/src/inject/event.js`): Custom event handlers, shortcuts, downloads, notifications

## Documentation Guidelines

- **Main README**: Common parameters only
- **CLI Documentation** (`docs/cli-usage.md`): ALL parameters with examples
- **Rare parameters**: Full docs in CLI usage, minimal in main README
- **NO technical documentation files**: Do not create separate technical docs, design docs, or implementation notes - keep technical details in memory/conversation only

## Platform Specifics

- **macOS**: `.icns` icons, universal builds with `--multi-arch`
- **Windows**: `.ico` icons, requires Visual Studio Build Tools
- **Linux**: `.png` icons, multiple formats (deb, AppImage, rpm)

## Quality Standards

**Code Standards:**

- Prefer composition over inheritance
- Use explicit types over implicit
- Write self-documenting code
- Follow existing patterns consistently
- **NO Chinese comments** - Use English only
- **NO unnecessary comments** - For simple, obvious code, let the code speak for itself

**Git Guidelines:**

- **NEVER commit automatically** - User handles all git operations
- **NEVER generate commit messages** - User writes their own
- Only make code changes, user decides when/how to commit
- Always test before user commits

## Branch Strategy

- `dev` - Active development, target for PRs
- `main` - Release branch for stable versions

## Prerequisites

- Node.js ≥22.0.0 (≥18.0.0 may work)
- Rust ≥1.89.0 (≥1.78.0 may work)
- Platform build tools (see CONTRIBUTING.md)
