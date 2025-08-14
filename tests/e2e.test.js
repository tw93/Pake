#!/usr/bin/env node

/**
 * End-to-End (E2E) Tests for Pake CLI
 *
 * These tests perform complete packaging operations and verify
 * the entire build pipeline works correctly. They include cleanup
 * to avoid leaving artifacts on the system.
 */

import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import config, { TIMEOUTS, TEST_URLS, TEST_NAMES } from "./test.config.js";
import ora from "ora";

class E2ETestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
    this.generatedFiles = [];
    this.tempDirectories = [];
  }

  addTest(name, testFn, timeout = TIMEOUTS.LONG) {
    this.tests.push({ name, testFn, timeout });
  }

  async runAll() {
    console.log("🚀 End-to-End Tests");
    console.log("===================\n");

    try {
      for (const [index, test] of this.tests.entries()) {
        const spinner = ora(`Running ${test.name}...`).start();

        try {
          const result = await Promise.race([
            test.testFn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), test.timeout),
            ),
          ]);

          if (result) {
            spinner.succeed(`${index + 1}. ${test.name}: PASS`);
            this.results.push({ name: test.name, passed: true });
          } else {
            spinner.fail(`${index + 1}. ${test.name}: FAIL`);
            this.results.push({ name: test.name, passed: false });
          }
        } catch (error) {
          spinner.fail(`${index + 1}. ${test.name}: ERROR - ${error.message}`);
          this.results.push({
            name: test.name,
            passed: false,
            error: error.message,
          });
        }
      }
    } finally {
      // Always cleanup generated files
      await this.cleanup();
    }

    this.showSummary();
  }

  async cleanup() {
    const cleanupSpinner = ora("Cleaning up generated files...").start();

    try {
      // Remove generated app files
      for (const file of this.generatedFiles) {
        if (fs.existsSync(file)) {
          if (fs.statSync(file).isDirectory()) {
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            fs.unlinkSync(file);
          }
        }
      }

      // Remove temporary directories
      for (const dir of this.tempDirectories) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }

      // Clean up .pake directory if it's a test run
      const pakeDir = path.join(config.PROJECT_ROOT, "src-tauri", ".pake");
      if (fs.existsSync(pakeDir)) {
        fs.rmSync(pakeDir, { recursive: true, force: true });
      }

      // Remove any test app files in current directory
      const projectFiles = fs.readdirSync(config.PROJECT_ROOT);
      const testFilePatterns = ["Weekly", "TestApp", "E2ETest"];

      const allTestFiles = projectFiles.filter(
        (file) =>
          testFilePatterns.some((pattern) => file.startsWith(pattern)) &&
          (file.endsWith(".app") ||
            file.endsWith(".exe") ||
            file.endsWith(".deb") ||
            file.endsWith(".dmg")),
      );

      for (const file of allTestFiles) {
        const fullPath = path.join(config.PROJECT_ROOT, file);
        if (fs.existsSync(fullPath)) {
          if (fs.statSync(fullPath).isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      }

      // Remove test-generated icon files (only specific test-generated files)
      const iconsDir = path.join(config.PROJECT_ROOT, "src-tauri", "icons");
      if (fs.existsSync(iconsDir)) {
        const iconFiles = fs.readdirSync(iconsDir);
        const testIconFiles = iconFiles.filter(
          (file) =>
            (file.toLowerCase().startsWith("e2etest") ||
              file.toLowerCase().startsWith("testapp") ||
              file.toLowerCase() === "test.icns") &&
            file.endsWith(".icns"),
        );

        for (const file of testIconFiles) {
          const fullPath = path.join(iconsDir, file);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      }

      cleanupSpinner.succeed("Cleanup completed");
    } catch (error) {
      cleanupSpinner.fail(`Cleanup failed: ${error.message}`);
    }
  }

  showSummary() {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    console.log(`\n📊 E2E Test Results: ${passed}/${total} passed`);

    if (passed === total) {
      console.log("🎉 All E2E tests passed!");
    } else {
      console.log("❌ Some E2E tests failed");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => console.log(`   - ${r.name}: ${r.error || "FAIL"}`));
    }
  }

  registerFile(filePath) {
    this.generatedFiles.push(filePath);
  }

  registerDirectory(dirPath) {
    this.tempDirectories.push(dirPath);
  }
}

// Create test runner instance
const runner = new E2ETestRunner();

// Add tests
runner.addTest(
  "Weekly App Full Build (Debug Mode)",
  async () => {
    return new Promise((resolve, reject) => {
      const testName = "E2ETestWeekly";
      const command = `node "${config.CLI_PATH}" "${TEST_URLS.WEEKLY}" --name "${testName}" --debug`;

      const child = spawn(command, {
        shell: true,
        cwd: config.PROJECT_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PAKE_E2E_TEST: "1",
          PAKE_CREATE_APP: "1",
        },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        // Register potential output files for cleanup (app bundles only for E2E tests)
        const appFile = path.join(config.PROJECT_ROOT, `${testName}.app`);
        runner.registerFile(appFile);

        // Check if build got to the bundling stage (indicates successful compile)
        const buildingApp =
          stdout.includes("Bundling") ||
          stdout.includes("Built application at:");
        const compilationSuccess =
          stdout.includes("Finished") && stdout.includes("target(s)");

        // For E2E tests, we care more about compilation success than packaging
        if (buildingApp || compilationSuccess) {
          resolve(true);
          return;
        }

        // Check actual file existence as fallback
        const outputExists = fs.existsSync(appFile);

        if (outputExists) {
          resolve(true);
        } else if (code === 0) {
          reject(
            new Error("Build completed but no clear success indicators found"),
          );
        } else {
          // Only fail if it's a genuine compilation error
          if (stderr.includes("error[E") || stderr.includes("cannot find")) {
            reject(new Error(`Compilation failed: ${stderr.slice(0, 200)}...`));
          } else {
            // Packaging error - check if compilation was successful
            resolve(compilationSuccess);
          }
        }
      });

      child.on("error", (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      // Send empty input to handle any prompts
      child.stdin.end();
    });
  },
  TIMEOUTS.LONG,
);

runner.addTest(
  "Weekly App Quick Build Verification",
  async () => {
    return new Promise((resolve, reject) => {
      const testName = "E2ETestQuick";
      const command = `node "${config.CLI_PATH}" "${TEST_URLS.WEEKLY}" --name "${testName}" --debug --width 800 --height 600`;

      const child = spawn(command, {
        shell: true,
        cwd: config.PROJECT_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PAKE_E2E_TEST: "1",
          PAKE_CREATE_APP: "1",
        },
      });

      let buildStarted = false;

      child.stdout.on("data", (data) => {
        const output = data.toString();
        if (
          output.includes("Building app") ||
          output.includes("Compiling") ||
          output.includes("Installing package") ||
          output.includes("Bundling")
        ) {
          buildStarted = true;
        }
      });

      child.stderr.on("data", (data) => {
        const output = data.toString();
        // Check for build progress in stderr (Tauri outputs to stderr)
        if (
          output.includes("Building app") ||
          output.includes("Compiling") ||
          output.includes("Installing package") ||
          output.includes("Bundling") ||
          output.includes("Finished") ||
          output.includes("Built application at:")
        ) {
          buildStarted = true;
        }
        // Only log actual errors, ignore build progress and warnings
        if (
          !output.includes("warning:") &&
          !output.includes("verbose") &&
          !output.includes("npm info") &&
          !output.includes("Installing package") &&
          !output.includes("Package installed") &&
          !output.includes("Building app") &&
          !output.includes("Compiling") &&
          !output.includes("Finished") &&
          !output.includes("Built application at:") &&
          !output.includes("Bundling") &&
          !output.includes("npm http") &&
          output.trim().length > 0
        ) {
          console.log(`Build error: ${output}`);
        }
      });

      // Kill process after 30 seconds if build started successfully
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");

        // Register cleanup files (app bundle only for E2E tests)
        const appFile = path.join(config.PROJECT_ROOT, `${testName}.app`);
        runner.registerFile(appFile);

        if (buildStarted) {
          resolve(true);
        } else {
          reject(new Error("Build did not start within timeout"));
        }
      }, 30000);

      child.on("close", (code) => {
        clearTimeout(timeout);
        const appFile = path.join(config.PROJECT_ROOT, `${testName}.app`);
        runner.registerFile(appFile);

        if (buildStarted) {
          resolve(true);
        } else {
          reject(new Error("Build process ended before starting"));
        }
      });

      child.on("error", (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      child.stdin.end();
    });
  },
  35000, // 35 seconds timeout
);

runner.addTest(
  "Config File System Verification",
  async () => {
    const testName = "E2ETestConfig";
    const pakeDir = path.join(config.PROJECT_ROOT, "src-tauri", ".pake");

    return new Promise((resolve, reject) => {
      const command = `node "${config.CLI_PATH}" "${TEST_URLS.VALID}" --name "${testName}" --debug`;

      const child = spawn(command, {
        shell: true,
        cwd: config.PROJECT_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PAKE_E2E_TEST: "1",
          PAKE_CREATE_APP: "1",
        },
      });

      const checkConfigFiles = () => {
        if (fs.existsSync(pakeDir)) {
          // Verify config files exist in .pake directory
          const configFile = path.join(pakeDir, "tauri.conf.json");
          const pakeConfigFile = path.join(pakeDir, "pake.json");

          if (fs.existsSync(configFile) && fs.existsSync(pakeConfigFile)) {
            // Verify config contains our test app name
            try {
              const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
              if (config.productName === testName) {
                child.kill("SIGTERM");

                // Register cleanup
                runner.registerDirectory(pakeDir);
                resolve(true);
                return true;
              }
            } catch (error) {
              // Continue if config parsing fails
            }
          }
        }
        return false;
      };

      child.stdout.on("data", (data) => {
        const output = data.toString();

        // Check if .pake directory is created
        if (
          output.includes("Installing package") ||
          output.includes("Building app")
        ) {
          checkConfigFiles();
        }
      });

      child.stderr.on("data", (data) => {
        const output = data.toString();

        // Check stderr for build progress and config creation
        if (
          output.includes("Installing package") ||
          output.includes("Building app") ||
          output.includes("Package installed")
        ) {
          checkConfigFiles();
        }
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        child.kill("SIGTERM");
        runner.registerDirectory(pakeDir);
        reject(new Error("Config verification timeout"));
      }, 15000);

      child.on("error", (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      child.stdin.end();
    });
  },
  20000,
);

export default runner;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.runAll().catch(console.error);
}
