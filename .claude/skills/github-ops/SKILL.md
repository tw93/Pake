---
name: github-ops
description: Use this skill for GitHub issue, PR, and release operations in the Pake repository via gh CLI.
---

# GitHub Operations Skill

Use this skill when working with GitHub issues, PRs, and releases for Pake.

## Golden Rule

**ALWAYS use `gh` CLI** for GitHub operations. Never use the web UI or make assumptions about state — always query first.

## Issue Operations

```bash
# View a specific issue
gh issue view 123

# List open issues
gh issue list --state open

# List issues with a label
gh issue list --label bug

# Add a comment (only with explicit user request)
gh issue comment 123 --body "..."

# Close an issue
gh issue close 123
```

## PR Operations

```bash
# List open PRs
gh pr list

# View a PR
gh pr view 456

# Check PR status and CI checks
gh pr checks 456

# View PR diff
gh pr diff 456

# Merge a PR (only with explicit user request)
gh pr merge 456 --squash

# Create a PR
gh pr create --title "..." --body "..."
```

## Release Operations

```bash
# List releases
gh release list

# View a specific release
gh release view V3.10.0

# Check CI runs for a tag
gh run list --workflow=release.yml

# Watch a running CI job
gh run watch

# View CI run logs
gh run view <run-id> --log
```

## CI / Workflow Operations

```bash
# List recent workflow runs
gh run list

# Filter by workflow
gh run list --workflow=release.yml
gh run list --workflow=quality-and-test.yml

# Re-run failed jobs
gh run rerun <run-id> --failed-only
```

## Safety Rules

1. **NEVER** comment on issues or PRs without explicit user request
2. **NEVER** merge, close, or modify without explicit user request
3. **ALWAYS** show the user the prepared content for review before posting
4. **ALWAYS** query current state before taking action — never assume
