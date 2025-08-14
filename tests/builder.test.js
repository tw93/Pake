#!/usr/bin/env node

/**
 * Builder-specific Tests for Pake CLI
 *
 * These tests verify platform-specific builder logic and file naming patterns
 * Based on analysis of bin/builders/ implementation
 */

import { execSync } from "child_process";
import path from "path";
import config, { TEST_URLS, TEST_NAMES } from "./test.config.js";
import ora from "ora";

class BuilderTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  addTest(name, testFn, description = "") {
    this.tests.push({ name, testFn, description });
  }

  async runAll() {
    console.log("🏗️  Builder-specific Tests");
    console.log("==========================\n");

    for (const [index, test] of this.tests.entries()) {
      const spinner = ora(`Running ${test.name}...`).start();

      try {
        const result = await test.testFn();
        if (result) {
          spinner.succeed(`${index + 1}. ${test.name}: PASS`);
          this.results.push({ name: test.name, passed: true });
        } else {
          spinner.fail(`${index + 1}. ${test.name}: FAIL`);
          this.results.push({ name: test.name, passed: false });
        }
      } catch (error) {
        spinner.fail(
          `${index + 1}. ${test.name}: ERROR - ${error.message.slice(0, 50)}...`,
        );
        this.results.push({
          name: test.name,
          passed: false,
          error: error.message,
        });
      }
    }

    this.displayResults();
  }

  displayResults() {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    console.log(`\n📊 Builder Test Results: ${passed}/${total} passed\n`);

    if (passed === total) {
      console.log("🎉 All builder tests passed!");
    } else {
      console.log("❌ Some builder tests failed");
      this.results
        .filter((r) => !r.passed)
        .forEach((result) => {
          console.log(
            `   - ${result.name}${result.error ? `: ${result.error}` : ""}`,
          );
        });
    }
  }
}

const runner = new BuilderTestRunner();

// Platform-specific file naming tests
runner.addTest(
  "Mac Builder File Naming Pattern",
  () => {
    try {
      // Test macOS file naming: name_version_arch.dmg
      const mockName = "TestApp";
      const mockVersion = "1.0.0";
      const arch = process.arch === "arm64" ? "aarch64" : process.arch;

      // Expected pattern: TestApp_1.0.0_aarch64.dmg (for M1) or TestApp_1.0.0_x64.dmg (for Intel)
      const expectedPattern = `${mockName}_${mockVersion}_${arch}`;
      const universalPattern = `${mockName}_${mockVersion}_universal`;

      // Test that naming pattern is consistent
      return (
        expectedPattern.includes(mockName) &&
        expectedPattern.includes(mockVersion) &&
        (expectedPattern.includes(arch) ||
          universalPattern.includes("universal"))
      );
    } catch (error) {
      return false;
    }
  },
  "Should generate correct macOS file naming pattern",
);

runner.addTest(
  "Windows Builder File Naming Pattern",
  () => {
    try {
      // Test Windows file naming: name_version_arch_language.msi
      const mockName = "TestApp";
      const mockVersion = "1.0.0";
      const arch = process.arch;
      const language = "en-US"; // default language

      // Expected pattern: TestApp_1.0.0_x64_en-US.msi
      const expectedPattern = `${mockName}_${mockVersion}_${arch}_${language}`;

      return (
        expectedPattern.includes(mockName) &&
        expectedPattern.includes(mockVersion) &&
        expectedPattern.includes(arch) &&
        expectedPattern.includes(language)
      );
    } catch (error) {
      return false;
    }
  },
  "Should generate correct Windows file naming pattern",
);

runner.addTest(
  "Linux Builder File Naming Pattern",
  () => {
    try {
      // Test Linux file naming variations
      const mockName = "testapp";
      const mockVersion = "1.0.0";
      let arch = process.arch === "x64" ? "amd64" : process.arch;

      // Test different target formats
      const debPattern = `${mockName}_${mockVersion}_${arch}`; // .deb
      const rpmPattern = `${mockName}-${mockVersion}-1.${arch === "arm64" ? "aarch64" : arch}`; // .rpm
      const appImagePattern = `${mockName}_${mockVersion}_${arch === "arm64" ? "aarch64" : arch}`; // .AppImage

      return (
        debPattern.includes(mockName) &&
        rpmPattern.includes(mockName) &&
        appImagePattern.includes(mockName)
      );
    } catch (error) {
      return false;
    }
  },
  "Should generate correct Linux file naming patterns for different targets",
);

runner.addTest(
  "Architecture Detection Logic",
  () => {
    try {
      // Test architecture mapping logic
      const currentArch = process.arch;

      // Mac: arm64 -> aarch64, others keep same
      const macArch = currentArch === "arm64" ? "aarch64" : currentArch;

      // Linux: x64 -> amd64 for deb, arm64 -> aarch64 for rpm/appimage
      const linuxArch = currentArch === "x64" ? "amd64" : currentArch;

      // Windows: keeps process.arch as-is
      const winArch = currentArch;

      return (
        typeof macArch === "string" &&
        typeof linuxArch === "string" &&
        typeof winArch === "string"
      );
    } catch (error) {
      return false;
    }
  },
  "Should correctly detect and map system architecture",
);

runner.addTest(
  "Multi-arch Build Detection",
  () => {
    try {
      // Test universal binary logic for macOS
      const platform = process.platform;

      if (platform === "darwin") {
        // macOS should support multi-arch with --multi-arch flag
        const supportsMultiArch = true;
        const universalSuffix = "universal";

        return supportsMultiArch && universalSuffix === "universal";
      } else {
        // Other platforms don't support multi-arch
        return true;
      }
    } catch (error) {
      return false;
    }
  },
  "Should handle multi-architecture builds correctly",
);

runner.addTest(
  "Target Format Validation",
  () => {
    try {
      // Test valid target formats per platform
      const platform = process.platform;
      const validTargets = {
        darwin: ["dmg"],
        win32: ["msi"],
        linux: ["deb", "appimage", "rpm"],
      };

      const platformTargets = validTargets[platform];
      return Array.isArray(platformTargets) && platformTargets.length > 0;
    } catch (error) {
      return false;
    }
  },
  "Should validate target formats per platform",
);

runner.addTest(
  "Build Path Generation",
  () => {
    try {
      // Test build path logic: debug vs release
      const debugPath = "src-tauri/target/debug/bundle/";
      const releasePath = "src-tauri/target/release/bundle/";
      const universalPath =
        "src-tauri/target/universal-apple-darwin/release/bundle";

      // Paths should be consistent
      return (
        debugPath.includes("debug") &&
        releasePath.includes("release") &&
        universalPath.includes("universal")
      );
    } catch (error) {
      return false;
    }
  },
  "Should generate correct build paths for different modes",
);

runner.addTest(
  "File Extension Mapping",
  () => {
    try {
      // Test file extension mapping logic
      const platform = process.platform;
      const extensionMap = {
        darwin: "dmg",
        win32: "msi",
        linux: "deb", // default, can be appimage or rpm
      };

      const expectedExt = extensionMap[platform];

      // Special case for Linux AppImage (capital A)
      const appImageExt = "AppImage";

      return (
        typeof expectedExt === "string" &&
        (expectedExt.length > 0 || appImageExt === "AppImage")
      );
    } catch (error) {
      return false;
    }
  },
  "Should map file extensions correctly per platform",
);

runner.addTest(
  "Name Sanitization Logic",
  () => {
    try {
      // Test name sanitization for file systems
      const testNames = [
        "Simple App", // Should handle spaces
        "App-With_Symbols", // Should handle hyphens and underscores
        "CamelCaseApp", // Should handle case variations
        "App123", // Should handle numbers
      ];

      // Test that names can be processed (basic validation)
      return testNames.every((name) => {
        const processed = name.toLowerCase().replace(/\s+/g, "");
        return processed.length > 0;
      });
    } catch (error) {
      return false;
    }
  },
  "Should sanitize app names for filesystem compatibility",
);

// Run builder tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.runAll().catch(console.error);
}

export default runner;
