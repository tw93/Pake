/**
 * Test Configuration for Pake CLI
 *
 * This file contains test configuration and utilities
 * shared across different test files.
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.dirname(__dirname);
export const CLI_PATH = path.join(PROJECT_ROOT, "dist/cli.js");

// Test timeouts (in milliseconds)
export const TIMEOUTS = {
  QUICK: 3000, // For version, help commands
  MEDIUM: 10000, // For validation tests
  LONG: 300000, // For build tests (5 minutes)
};

// Test URLs for different scenarios
export const TEST_URLS = {
  WEEKLY: "https://weekly.tw93.fun",
  VALID: "https://example.com",
  GITHUB: "https://github.com",
  GOOGLE: "https://www.google.com",
  INVALID: "not://a/valid[url]",
  LOCAL: "./test-file.html",
};

// Test assets for different scenarios
export const TEST_ASSETS = {
  WEEKLY_ICNS: "https://cdn.tw93.fun/pake/weekly.icns",
  INVALID_ICON: "https://example.com/nonexistent.icns",
};

// Test app names
export const TEST_NAMES = {
  WEEKLY: "Weekly",
  BASIC: "TestApp",
  DEBUG: "DebugApp",
  FULL: "FullscreenApp",
  GOOGLE_TRANSLATE: "Google Translate",
  MAC: "MacApp",
};

// Expected file extensions by platform
export const PLATFORM_EXTENSIONS = {
  darwin: "dmg",
  win32: "msi",
  linux: "deb",
};

// Helper functions
export const testHelpers = {
  /**
   * Clean test name for filesystem
   */
  sanitizeName: (name) => name.replace(/[^a-zA-Z0-9]/g, ""),

  /**
   * Get expected output file for current platform
   */
  getExpectedOutput: (appName) => {
    const ext = PLATFORM_EXTENSIONS[process.platform] || "bin";
    return `${appName}.${ext}`;
  },

  /**
   * Create test command with common options
   */
  createCommand: (url, options = {}) => {
    const baseCmd = `node "${CLI_PATH}" "${url}"`;
    const optionsStr = Object.entries(options)
      .map(([key, value]) => {
        if (value === true) return `--${key}`;
        if (value === false) return "";
        return `--${key} "${value}"`;
      })
      .filter(Boolean)
      .join(" ");

    return `${baseCmd} ${optionsStr}`.trim();
  },
};

export default {
  PROJECT_ROOT,
  CLI_PATH,
  TIMEOUTS,
  TEST_URLS,
  TEST_NAMES,
  PLATFORM_EXTENSIONS,
  testHelpers,
};
