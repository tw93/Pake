# Pake CLI Test Suite

This directory contains the complete test suite for the Pake CLI tool.

## Quick Start

```bash
# Run all tests (unit + integration + builder)
npm test
```

## Test Structure

```tree
tests/
├── index.js              # Main test runner
├── cli.test.js           # Unit tests for CLI functionality
├── integration.test.js   # Integration tests
├── builder.test.js       # Platform-specific builder tests
├── test.config.js        # Shared test configuration
└── README.md            # This file
```

## Test Categories

### 1. Unit Tests (`cli.test.js`)

Fast tests that verify individual CLI functions:

- ✅ Version command
- ✅ Help command
- ✅ Argument validation
- ✅ URL validation (including weekly.tw93.fun)
- ✅ Number validation
- ✅ Dependency checks
- ✅ Response time
- ✅ Remote icon URL validation
- ✅ Configuration merging logic

### 2. Integration Tests (`integration.test.js`)

Tests that verify components work together:

- ✅ Process spawning
- ✅ Interactive mode
- ✅ Build command construction
- ✅ File system permissions
- ✅ Dependency resolution

### 3. Builder Tests (`builder.test.js`)

Platform-specific builder logic tests:

- ✅ Mac file naming patterns
- ✅ Windows file naming patterns
- ✅ Linux file naming patterns (deb/rpm/AppImage)
- ✅ Architecture detection logic
- ✅ Multi-arch build detection
- ✅ Target format validation

All tests run automatically with: `npm test`

## Test Commands

| Command             | Description             | Coverage                     | Duration    |
| ------------------- | ----------------------- | ---------------------------- | ----------- |
| `npm test`          | Run all automated tests | Unit + Integration + Builder | ~30 seconds |
| `npm run cli:build` | Build CLI for testing   | Development setup            | ~5 seconds  |

**GitHub Actions Integration:**

- Automated testing on push/PR to main/dev branches
- Multi-platform testing (Ubuntu, Windows, macOS)
- Quality checks and code formatting validation

## Manual Testing Scenarios

### Basic Usage

```bash
# Test basic app creation with weekly.tw93.fun
node dist/cli.js https://weekly.tw93.fun --name "Weekly"

# Test with custom dimensions
node dist/cli.js https://weekly.tw93.fun --name "Weekly" --width 1200 --height 800

# Test debug mode
node dist/cli.js https://weekly.tw93.fun --name "DebugApp" --debug
```

### Advanced Features

```bash
# Test with remote CDN icon
node dist/cli.js https://weekly.tw93.fun --name "IconWeekly" --icon "https://gw.alipayobjects.com/os/k/fw/weekly.icns"

# Test with injection files (create test files first)
echo "body { background: red; }" > test.css
echo "console.log('injected');" > test.js
node dist/cli.js https://weekly.tw93.fun --name "InjectionApp" --inject ./test.css,./test.js

# Test fullscreen app
node dist/cli.js https://weekly.tw93.fun --name "FullWeekly" --fullscreen

# Test system tray integration
node dist/cli.js https://weekly.tw93.fun --name "TrayWeekly" --show-system-tray
```

### Platform-Specific (macOS)

```bash
# Test universal binary
node dist/cli.js https://weekly.tw93.fun --name "Weekly" --multi-arch

# Test hidden title bar
node dist/cli.js https://weekly.tw93.fun --name "ImmersiveWeekly" --hide-title-bar

# Test dark mode
node dist/cli.js https://weekly.tw93.fun --name "DarkWeekly" --dark-mode
```

## Test Configuration

Tests use configuration from `test.config.js`:

```javascript
export const TIMEOUTS = {
  QUICK: 3000, // Quick commands
  MEDIUM: 10000, // Validation tests
  LONG: 300000, // Build tests
};

export const TEST_URLS = {
  WEEKLY: "https://weekly.tw93.fun",
  VALID: "https://example.com",
  GITHUB: "https://github.com",
  INVALID: "not://a/valid[url]",
};

export const TEST_ASSETS = {
  WEEKLY_ICNS: "https://gw.alipayobjects.com/os/k/fw/weekly.icns",
};
```

## Adding New Tests

### Unit Test

```javascript
// In cli.test.js
runner.addTest(
  "My New Test",
  () => {
    // Test logic here
    return true; // or false
  },
  "Test description"
);
```

### Integration Test

```javascript
// In integration.test.js
runner.addTest(
  "My Integration Test",
  async () => {
    // Async test logic
    return await someAsyncOperation();
  },
  TIMEOUTS.MEDIUM
);
```

## Continuous Integration

The project uses simplified GitHub Actions workflows:

### Current Workflows:

- **`quality-and-test.yml`** - Runs all tests, code formatting, and Rust quality checks
- **`claude-unified.yml`** - Claude AI integration for code review and assistance
- **`release.yml`** - Handles releases, app building, and Docker publishing
- **`pake-cli.yaml`** - Manual CLI building workflow
- **`pake_build_single_app.yaml`** - Reusable single app building workflow

### Integration Example:

```yaml
# Automatic testing on push/PR
- name: Run Quality & Tests
  run: npm test

# Manual CLI building
- name: Build CLI
  run: npm run cli:build
```

## Troubleshooting

### Common Issues

1. **"CLI file not found"**

   ```bash
   npm run cli:build
   ```

2. **"Permission denied"**

   ```bash
   chmod +x tests/index.js
   ```

3. **"Timeout errors"**
   - Increase timeout in `test.config.js`
   - Check system resources

### Debug Mode

Run tests with debug output:

```bash
DEBUG=1 npm test
```

## Performance Expectations

| Platform  | First Build | Subsequent | Memory |
| --------- | ----------- | ---------- | ------ |
| M1 Mac    | 2-3 min     | 30-45s     | ~200MB |
| Intel Mac | 3-4 min     | 45-60s     | ~250MB |
| Linux     | 4-5 min     | 60-90s     | ~300MB |
| Windows   | 5-6 min     | 90-120s    | ~350MB |

## Contributing

When adding new features:

1. Add unit tests for new functions
2. Add integration tests for new workflows
3. Update manual test scenarios
4. Run full test suite before submitting

```bash
# Pre-commit test routine
npm run cli:build
npm test
npm run test:build
```
