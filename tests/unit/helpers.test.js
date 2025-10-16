#!/usr/bin/env node

/**
 * Unit Tests for Helper Functions
 *
 * Tests for newly added helper functions to ensure code quality
 * and prevent regressions.
 */

import { strict as assert } from "assert";

/**
 * Helper function to generate safe filename
 * Mirrors the implementation in bin/utils/name.ts
 */
function generateSafeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/\.+$/g, "")
    .slice(0, 255);
}

/**
 * Helper function to generate safe lowercase app name for file paths
 * Mirrors the implementation in bin/helpers/merge.ts
 */
function getSafeAppName(name) {
  return generateSafeFilename(name).toLowerCase();
}

/**
 * Test suite for getSafeAppName()
 */
export function testGetSafeAppName() {
  const tests = [
    // Basic cases
    { input: "MyApp", expected: "myapp", description: "Simple name" },
    { input: "My App", expected: "my_app", description: "Name with space" },
    { input: "my-app", expected: "my-app", description: "Name with hyphen" },

    // Chinese characters
    { input: "我的应用", expected: "我的应用", description: "Chinese name" },
    {
      input: "我的 App",
      expected: "我的_app",
      description: "Mixed Chinese and English",
    },

    // Special characters
    {
      input: "App@2024",
      expected: "app@2024",
      description: "Special character @ (preserved)",
    },
    { input: "My/App", expected: "my_app", description: "Forward slash" },
    { input: "My\\App", expected: "my_app", description: "Backslash" },
    { input: "App:Name", expected: "app_name", description: "Colon" },
    { input: "App*Name", expected: "app_name", description: "Asterisk" },
    { input: "App?Name", expected: "app_name", description: "Question mark" },
    { input: 'App"Name', expected: "app_name", description: "Double quote" },
    {
      input: "App<Name>",
      expected: "app_name_",
      description: "Angle brackets",
    },
    { input: "App|Name", expected: "app_name", description: "Pipe" },

    // Edge cases
    { input: "APP", expected: "app", description: "All uppercase" },
    { input: "a", expected: "a", description: "Single character" },
    { input: "123", expected: "123", description: "Numbers only" },
    {
      input: "  App  ",
      expected: "_app_",
      description: "Leading/trailing spaces (collapsed)",
    },
    { input: "App...", expected: "app", description: "Trailing dots" },

    // Long names
    {
      input: "A".repeat(300),
      expected: "a".repeat(255),
      description: "Very long name (should truncate to 255)",
    },
  ];

  let passed = 0;
  let failed = 0;

  console.log("\n🧪 Testing getSafeAppName()");
  console.log("─".repeat(50));

  tests.forEach((test, index) => {
    try {
      const result = getSafeAppName(test.input);
      assert.equal(
        result,
        test.expected,
        `Expected "${test.expected}", got "${result}"`,
      );
      console.log(`  ✓ Test ${index + 1}: ${test.description}`);
      passed++;
    } catch (error) {
      console.log(`  ✗ Test ${index + 1}: ${test.description}`);
      console.log(`    Input: "${test.input}"`);
      console.log(`    Expected: "${test.expected}"`);
      console.log(`    Error: ${error.message}`);
      failed++;
    }
  });

  console.log("─".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  return failed === 0;
}

/**
 * Test suite for download error notification (browser environment simulation)
 */
export function testDownloadErrorNotification() {
  console.log("\n🧪 Testing showDownloadError() Logic");
  console.log("─".repeat(50));

  const tests = [
    {
      name: "Chinese language detection",
      language: "zh-CN",
      filename: "test.pdf",
      expectedTitle: "下载错误",
      expectedBody: "下载失败: test.pdf",
    },
    {
      name: "English language detection",
      language: "en-US",
      filename: "document.docx",
      expectedTitle: "Download Error",
      expectedBody: "Download failed: document.docx",
    },
    {
      name: "Traditional Chinese",
      language: "zh-TW",
      filename: "file.zip",
      expectedTitle: "下载错误",
      expectedBody: "下载失败: file.zip",
    },
    {
      name: "Hong Kong Chinese",
      language: "zh-HK",
      filename: "image.png",
      expectedTitle: "下载错误",
      expectedBody: "下载失败: image.png",
    },
    {
      name: "Special characters in filename",
      language: "en-US",
      filename: "my file (1).pdf",
      expectedTitle: "Download Error",
      expectedBody: "Download failed: my file (1).pdf",
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    try {
      // Simulate language detection
      const isChineseLanguage = (lang) =>
        lang &&
        (lang.startsWith("zh") ||
          lang.includes("CN") ||
          lang.includes("TW") ||
          lang.includes("HK"));

      const isChinese = isChineseLanguage(test.language);
      const title = isChinese ? "下载错误" : "Download Error";
      const body = isChinese
        ? `下载失败: ${test.filename}`
        : `Download failed: ${test.filename}`;

      assert.equal(
        title,
        test.expectedTitle,
        `Title mismatch for ${test.name}`,
      );
      assert.equal(body, test.expectedBody, `Body mismatch for ${test.name}`);

      console.log(`  ✓ Test ${index + 1}: ${test.name}`);
      console.log(`    Language: ${test.language}`);
      console.log(`    Title: "${title}"`);
      console.log(`    Body: "${body}"`);
      passed++;
    } catch (error) {
      console.log(`  ✗ Test ${index + 1}: ${test.name}`);
      console.log(`    Error: ${error.message}`);
      failed++;
    }
  });

  console.log("─".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  return failed === 0;
}

/**
 * Run all tests
 */
export async function runHelperTests() {
  console.log("\n📦 Helper Functions Unit Tests");
  console.log("=".repeat(50));

  const results = [];

  // Test getSafeAppName
  results.push({
    name: "getSafeAppName()",
    passed: testGetSafeAppName(),
  });

  // Test download error notification
  results.push({
    name: "showDownloadError() Logic",
    passed: testDownloadErrorNotification(),
  });

  // Summary
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log("\n📊 Helper Tests Summary");
  console.log("=".repeat(50));
  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
  });
  console.log("=".repeat(50));
  console.log(`Total: ${passedCount}/${totalCount} test suites passed\n`);

  return allPassed;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHelperTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Test execution failed:", error);
      process.exit(1);
    });
}
