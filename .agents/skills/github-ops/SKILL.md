---
name: github-ops
description: GitHub issue, PR, and release operations via gh CLI. Not for code review or release builds.
version: 2.1.0
allowed-tools:
  - Bash
  - Read
---

# GitHub Operations Skill

Use this skill when working with GitHub issues, PRs, and releases for Pake. It carries the project facts and boundaries; standard `gh` usage is assumed.

## Golden Rule

Always use `gh` CLI and query live state before acting. Never assume state from memory or a previous turn.

## Project Facts

- Repo: `tw93/Pake`. Workflows: `release.yml` (`V*` tag, builds app assets), `npm-publish.yml` (npm Trusted Publishing; also `workflow_dispatch` from `main` for npm-only hotfixes), `quality-and-test.yml` (push CI), `pake-cli.yaml` / `single-app.yaml` (public build surfaces external users trigger from forks).
- Poll CI with `gh run view <run-id> --json status,conclusion`. Never pipe `gh run watch` or build output through `tail`/`head`; pipes swallow the real exit code and misreport failures as green.
- Verify npm state with `npm view pake-cli@<version> version gitHead dist.tarball --json`; `gitHead` ties the published package to the intended commit. Check the `latest` pointer separately with `npm view pake-cli version`; it can point at a different commit than the fix under review.
- Inline PR review comments live at `gh api repos/tw93/Pake/pulls/<n>/comments`; `gh pr view` does not show them.
- App-release truth is `gh release view <tag> --json assets` (asset count/state), not workflow names or source state.

## Safety Rules

1. **ALWAYS** draft the reply first and show it to the user for approval before calling any write operation (`gh issue comment`, `gh pr comment`, `gh pr merge`, `gh issue close`, `gh release create`, etc.). Approval of one draft does not extend to future comments.
2. **NEVER** merge, close, or modify without explicit user request.
3. **ALWAYS** query current state before taking action — never assume.
4. Before replying to an issue or PR, read the body to confirm the author's language; match their language in the reply. This applies to the author, not to arbitrary thread commenters.
5. Before replying that a CLI fix is released, verify the exact artifact with `npm view pake-cli@<version> version gitHead dist.tarball --json` and confirm `gitHead` contains the fix. Check `npm view pake-cli version` separately for the `latest` pointer. For app releases, use `gh release view <tag> --json assets`.
6. Before closing an issue after release, confirm the target with `gh issue view <id> --json number,title,state,author,url` and include the concrete version or upgrade command in the comment.
