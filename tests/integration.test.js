#!/usr/bin/env node

/**
 * Integration Tests for Pake CLI
 *
 * These tests verify that different components work together correctly.
 * They may take longer to run as they test actual build processes.
 */

import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import config, { TIMEOUTS, TEST_URLS } from "./test.config.js";
import ora from "ora";

class IntegrationTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
    this.tempFiles = [];
  }

  addTest(name, testFn, timeout = TIMEOUTS.MEDIUM) {
    this.tests.push({ name, testFn, timeout });
  }

  async runAll() {
    console.log("🔧 Integration Tests");
    console.log("====================\n");

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

    this.cleanup();
    this.displayResults();
  }

  cleanup() {
    // Clean up any temporary files created during tests
    this.tempFiles.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up ${file}`);
      }
    });
  }

  displayResults() {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    console.log(`\n📊 Integration Test Results: ${passed}/${total} passed\n`);

    if (passed === total) {
      console.log("🎉 All integration tests passed!");
    } else {
      console.log("❌ Some integration tests failed");
      this.results
        .filter((r) => !r.passed)
        .forEach((result) => {
          console.log(
            `   - ${result.name}${result.error ? `: ${result.error}` : ""}`,
          );
        });
    }
  }

  trackTempFile(filepath) {
    this.tempFiles.push(filepath);
  }
}

const runner = new IntegrationTestRunner();

// Integration Tests
runner.addTest("CLI Process Spawning", () => {
  return new Promise((resolve) => {
    const child = spawn("node", [config.CLI_PATH, "--version"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      resolve(code === 0 && /\d+\.\d+\.\d+/.test(output));
    });

    // Kill after 3 seconds if still running
    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 3000);
  });
});

runner.addTest(
  "Interactive Mode Simulation",
  () => {
    return new Promise((resolve) => {
      const child = spawn("node", [config.CLI_PATH, TEST_URLS.WEEKLY], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let output = "";
      let prompted = false;

      child.stdout.on("data", (data) => {
        output += data.toString();
        // If we see a prompt for application name, provide input
        if (output.includes("Enter your application name") && !prompted) {
          prompted = true;
          child.stdin.write("TestApp\n");
          setTimeout(() => {
            child.kill();
            resolve(true);
          }, 1000);
        }
      });

      child.on("close", () => {
        resolve(prompted);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        resolve(false);
      }, 10000);
    });
  },
  TIMEOUTS.MEDIUM,
);

runner.addTest(
  "Command Line Argument Parsing",
  () => {
    try {
      // Test argument validation by running CLI with --help to verify args are parsed
      const helpOutput = execSync(`node "${config.CLI_PATH}" --help`, {
        encoding: "utf8",
        timeout: 3000,
      });

      // Verify that our command structure is valid by checking help includes our options
      const validOptions = ["--width", "--height", "--debug", "--name"].every(
        (opt) => helpOutput.includes(opt),
      );

      return validOptions;
    } catch (error) {
      return false;
    }
  },
  TIMEOUTS.QUICK,
);

runner.addTest("File System Permissions", () => {
  try {
    // Test that we can write to current directory
    const testFile = "test-write-permission.tmp";
    fs.writeFileSync(testFile, "test");
    runner.trackTempFile(testFile);

    // Test that we can read from CLI directory
    const cliStats = fs.statSync(config.CLI_PATH);
    return cliStats.isFile();
  } catch (error) {
    return false;
  }
});

runner.addTest("Dependency Resolution", () => {
  try {
    // Verify that essential runtime dependencies are available
    const packageJsonPath = path.join(config.PROJECT_ROOT, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    const essentialDeps = [
      "commander",
      "chalk",
      "fs-extra",
      "execa",
      "prompts",
    ];

    return essentialDeps.every((dep) => {
      try {
        // Try to resolve the dependency
        import.meta.resolve
          ? import.meta.resolve(dep)
          : require.resolve(dep, { paths: [config.PROJECT_ROOT] });
        return true;
      } catch {
        return packageJson.dependencies && packageJson.dependencies[dep];
      }
    });
  } catch {
    return false;
  }
});

// Run integration tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.runAll().catch(console.error);
}

export default runner;
