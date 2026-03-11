---
name: code-review
description: Use this skill for Pake PR reviews with focus on TypeScript/Rust correctness, Tauri patterns, and CLI behavior.
---

# Code Review Skill

Use this skill when reviewing code changes or PRs in Pake.

## Review Checklist

### Code Quality
- [ ] Follows TypeScript idioms and patterns
- [ ] Rust code follows Tauri conventions
- [ ] Proper error handling in CLI
- [ ] No unnecessary dependencies

### Testing
- [ ] Tests pass: `pnpm test`
- [ ] Format check: `pnpm run format:check`
- [ ] CLI builds successfully

### Style
- [ ] Prettier formatted
- [ ] Rust code formatted with `cargo fmt`
- [ ] Clear naming conventions

## Quick Review Commands

```bash
# Get PR diff
gh pr diff

# Format check
pnpm run format:check

# Run tests
pnpm test

# Build CLI
pnpm run cli:build
```

## Review Output Format

1. **Critical issues** (blocking): Safety, correctness
2. **Style issues** (non-blocking): Formatting, naming
3. **Suggestions** (optional): Performance, clarity
