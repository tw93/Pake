# Scripts and AI Agents

<div align="center">

**English** · [中文](ai-agents_CN.md)

</div>

Pake has a machine-readable mode, so a script or an AI agent can package an app and read the result without parsing build logs.

## What to use

- [`--json`](cli-usage.md#json): stdout carries exactly one JSON result, every log line goes to stderr, and interactive prompts are off. The same section lists the exit codes and error codes.
- [`--config app.json`](cli-usage.md#config): describe the app in a file instead of a row of flags. Fields are the camelCase option names plus `url`, checked against the [published schema](../schema/pake.schema.json), and a flag on the command line wins over the file.
- `pake ./dist --name MyTool`: package local build output directly. The folder needs an `index.html` at its root.

```bash
pake --config app.json --json
```

## The agent contract

[llms.txt](../llms.txt) sums up what an agent needs in one page: the JSON shape, exit codes, config rules and the platform notes. The copy that ships with the latest release is at `https://unpkg.com/pake-cli@latest/llms.txt`.

## Install the skill

The official Pake skill teaches Claude Code and Codex the steps above.

```text
# Claude Code
/plugin marketplace add tw93/Pake
/plugin install pake@pake

# Codex
codex plugin marketplace add tw93/Pake
codex plugin add pake@pake
```

## A prompt to start with

Without the skill, paste this to your agent and fill in the last line:

```text
Use Pake (npm i -g pake-cli) to package webpages as desktop apps. Read https://unpkg.com/pake-cli@latest/llms.txt first; always run pake with --json and parse stdout as a single JSON object. Package <url-or-local-dist> into an app named <AppName>.
```
