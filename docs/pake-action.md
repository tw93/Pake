# Pake Action

Transform any webpage into a lightweight desktop app with a single GitHub Actions step.

> This guide shows how to use Pake as a GitHub Action in your own projects. For using our project's built-in GitHub Actions workflow, see [GitHub Actions Usage](github-actions-usage.md).

## Quick Start

```yaml
- name: Build Pake App
  uses: tw93/Pake@v3
  with:
    url: "https://example.com"
    name: "MyApp"
```

## Inputs

| Parameter    | Description              | Required | Default |
| ------------ | ------------------------ | -------- | ------- |
| `url`        | Target URL to package    | ✅       |         |
| `name`       | Application name         | ✅       |         |
| `output-dir` | Output directory         |          | `dist`  |
| `icon`       | Custom app icon URL/path |          |         |
| `width`      | Window width             |          | `1200`  |
| `height`     | Window height            |          | `780`   |
| `debug`      | Enable debug mode        |          | `false` |

## Outputs

| Output         | Description                   |
| -------------- | ----------------------------- |
| `package-path` | Path to the generated package |

## Examples

### Basic Usage

```yaml
name: Build Web App
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tw93/Pake@v3
        with:
          url: "https://weekly.tw93.fun"
          name: "WeeklyApp"
```

### With Custom Icon

```yaml
- uses: tw93/Pake@v3
  with:
    url: "https://example.com"
    name: "MyApp"
    icon: "https://example.com/icon.png"
    width: 1400
    height: 900
```

### Multi-Platform Build

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: tw93/Pake@v3
        with:
          url: "https://example.com"
          name: "CrossPlatformApp"
```

## How It Works

1. **Auto Setup**: Installs Rust, Node.js dependencies, builds Pake CLI
2. **Build App**: Runs `pake` command with your parameters
3. **Package Output**: Finds and moves the generated package to output directory

## Supported Platforms

- **Linux**: `.deb` packages (Ubuntu runners)
- **macOS**: `.app` and `.dmg` packages (macOS runners)
- **Windows**: `.exe` and `.msi` packages (Windows runners)

Use GitHub's matrix strategy to build for multiple platforms simultaneously.

## Related Documentation

- [GitHub Actions Usage](github-actions-usage.md) - Using Pake's built-in workflow
- [CLI Usage](cli-usage.md) - Command-line interface reference
- [Advanced Usage](advanced-usage.md) - Customization options
