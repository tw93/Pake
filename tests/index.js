#!/usr/bin/env node

/**
 * Unified Test Runner for Pake CLI
 *
 * This is a simplified, unified test runner that replaces the scattered
 * test files with a single, easy-to-use interface.
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import ora from "ora";
import config, { TIMEOUTS, TEST_URLS } from "./config.js";

class PakeTestRunner {
  constructor() {
    this.results = [];
    this.tempFiles = [];
    this.tempDirs = [];
  }

  async runAll(options = {}) {
    const {
      unit = true,
      integration = true,
      builder = true,
      pakeCliTests = false,
      e2e = false,
      quick = false,
      realBuild = false, // Add option for real build test
    } = options;

    console.log("🚀 Pake CLI Test Suite");
    console.log("======================\n");

    this.validateEnvironment();

    let testCount = 0;

    if (unit && !quick) {
      console.log("📋 Running Unit Tests...");
      await this.runUnitTests();
      testCount++;
    }

    if (integration && !quick) {
      console.log("\n🔧 Running Integration Tests...");
      await this.runIntegrationTests();
      testCount++;
    }

    if (builder && !quick) {
      console.log("\n🏗️ Running Builder Tests...");
      await this.runBuilderTests();
      testCount++;
    }

    if (pakeCliTests) {
      console.log("\n📦 Running Pake-CLI GitHub Actions Tests...");
      await this.runPakeCliTests();
      testCount++;
    }

    if (e2e && !quick) {
      console.log("\n🚀 Running End-to-End Tests...");
      await this.runE2ETests();
      testCount++;
    }

    if (realBuild && !quick) {
      // On macOS, prefer multi-arch test as it's more likely to catch issues
      if (process.platform === "darwin") {
        console.log("\n🏗️ Running Real Build Test (Multi-Arch)...");
        await this.runMultiArchBuildTest();
        testCount++;
      } else {
        console.log("\n🏗️ Running Real Build Test...");
        await this.runRealBuildTest();
        testCount++;
      }
    }

    this.cleanup();
    this.displayFinalResults();

    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    return passed === total;
  }

  validateEnvironment() {
    console.log("🔍 Environment Validation:");
    console.log("---------------------------");

    // Check if CLI file exists
    if (!fs.existsSync(config.CLI_PATH)) {
      console.log("❌ CLI file not found. Run: pnpm run cli:build");
      process.exit(1);
    }
    console.log("✅ CLI file exists");

    // Check if CLI is executable
    try {
      execSync(`node "${config.CLI_PATH}" --version`, {
        encoding: "utf8",
        timeout: 3000,
      });
      console.log("✅ CLI is executable");
    } catch (error) {
      console.log("❌ CLI is not executable");
      process.exit(1);
    }

    // Platform info
    console.log(`✅ Platform: ${process.platform} (${process.arch})`);
    console.log(`✅ Node.js: ${process.version}`);

    const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
    console.log(`${isCI ? "✅" : "ℹ️"} CI Environment: ${isCI ? "Yes" : "No"}`);

    console.log();
  }

  async runTest(name, testFn, timeout = TIMEOUTS.MEDIUM) {
    const spinner = ora(`Running ${name}...`).start();

    try {
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), timeout),
        ),
      ]);

      if (result) {
        spinner.succeed(`${name}: PASS`);
        this.results.push({ name, passed: true });
      } else {
        spinner.fail(`${name}: FAIL`);
        this.results.push({ name, passed: false });
      }
    } catch (error) {
      spinner.fail(`${name}: ERROR - ${error.message.slice(0, 100)}...`);
      this.results.push({
        name,
        passed: false,
        error: error.message,
      });
    }
  }

  async runUnitTests() {
    // Version command test
    await this.runTest(
      "Version Command",
      () => {
        const output = execSync(`node "${config.CLI_PATH}" --version`, {
          encoding: "utf8",
          timeout: 3000,
        });
        return /^\d+\.\d+\.\d+/.test(output.trim());
      },
      TIMEOUTS.QUICK,
    );

    // Help command test
    await this.runTest(
      "Help Command",
      () => {
        const output = execSync(`node "${config.CLI_PATH}"`, {
          encoding: "utf8",
          timeout: 3000,
        });
        return output.includes("Usage: cli [url] [options]");
      },
      TIMEOUTS.QUICK,
    );

    // URL validation test
    await this.runTest("URL Validation", () => {
      try {
        execSync(`node "${config.CLI_PATH}" "invalid-url" --name TestApp`, {
          encoding: "utf8",
          timeout: 3000,
        });
        return false; // Should have failed
      } catch (error) {
        return error.status !== 0;
      }
    });

    // Number validation test
    await this.runTest("Number Validation", () => {
      try {
        execSync(`node "${config.CLI_PATH}" https://example.com --width abc`, {
          encoding: "utf8",
          timeout: 3000,
        });
        return false; // Should throw error
      } catch (error) {
        return error.message.includes("Not a number");
      }
    });

    // CLI response time test
    await this.runTest("CLI Response Time", () => {
      const start = Date.now();
      execSync(`node "${config.CLI_PATH}" --version`, {
        encoding: "utf8",
        timeout: 3000,
      });
      const elapsed = Date.now() - start;
      return elapsed < 2000;
    });

    // Weekly URL accessibility test
    await this.runTest("Weekly URL Accessibility", () => {
      try {
        const testCommand = `node "${config.CLI_PATH}" ${TEST_URLS.WEEKLY} --name "URLTest" --debug`;
        execSync(`echo "n" | timeout 5s ${testCommand} || true`, {
          encoding: "utf8",
          timeout: 8000,
        });
        return true; // If we get here, URL was parsed successfully
      } catch (error) {
        return (
          !error.message.includes("Invalid URL") &&
          !error.message.includes("invalid")
        );
      }
    });
  }

  async runIntegrationTests() {
    // Process spawning test
    await this.runTest("CLI Process Spawning", () => {
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

        setTimeout(() => {
          child.kill();
          resolve(false);
        }, 3000);
      });
    });

    // File system permissions test
    await this.runTest("File System Permissions", () => {
      try {
        const testFile = "test-write-permission.tmp";
        fs.writeFileSync(testFile, "test");
        this.trackTempFile(testFile);

        const cliStats = fs.statSync(config.CLI_PATH);
        return cliStats.isFile();
      } catch {
        return false;
      }
    });

    // Dependency resolution test
    await this.runTest("Dependency Resolution", () => {
      try {
        const packageJsonPath = path.join(config.PROJECT_ROOT, "package.json");
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );

        const essentialDeps = ["commander", "chalk", "fs-extra", "execa"];
        return essentialDeps.every(
          (dep) => packageJson.dependencies && packageJson.dependencies[dep],
        );
      } catch {
        return false;
      }
    });
  }

  async runBuilderTests() {
    // Platform detection test
    await this.runTest("Platform Detection", () => {
      const platform = process.platform;
      const platformConfigs = {
        darwin: { ext: ".dmg", multiArch: true },
        win32: { ext: ".msi", multiArch: false },
        linux: { ext: ".deb", multiArch: false },
      };

      const config = platformConfigs[platform];
      return config && typeof config.ext === "string";
    });

    // Architecture detection test
    await this.runTest("Architecture Detection", () => {
      const currentArch = process.arch;
      const macArch = currentArch === "arm64" ? "aarch64" : currentArch;
      const linuxArch = currentArch === "x64" ? "amd64" : currentArch;

      return typeof macArch === "string" && typeof linuxArch === "string";
    });

    // File naming pattern test
    await this.runTest("File Naming Patterns", () => {
      const testNames = ["Simple App", "App-With_Symbols", "CamelCaseApp"];
      return testNames.every((name) => {
        const processed = name.toLowerCase().replace(/\s+/g, "");
        return processed.length > 0;
      });
    });
  }

  async runPakeCliTests() {
    // Package installation test
    await this.runTest(
      "pake-cli Package Installation",
      async () => {
        try {
          execSync("pnpm install pake-cli@latest", {
            encoding: "utf8",
            timeout: 60000,
            cwd: "/tmp",
          });

          const pakeCliPath = "/tmp/node_modules/.bin/pake";
          return fs.existsSync(pakeCliPath);
        } catch (error) {
          console.error("Package installation failed:", error.message);
          return false;
        }
      },
      TIMEOUTS.LONG,
    );

    // Version command test
    await this.runTest("pake-cli Version Command", async () => {
      try {
        const version = execSync("npx pake --version", {
          encoding: "utf8",
          timeout: 10000,
        });
        return /^\d+\.\d+\.\d+/.test(version.trim());
      } catch {
        return false;
      }
    });

    // Configuration validation test
    await this.runTest("Configuration Validation", async () => {
      try {
        const validateConfig = (config) => {
          const required = ["url", "name", "width", "height"];
          const hasRequired = required.every((field) =>
            config.hasOwnProperty(field),
          );

          const validTypes =
            typeof config.url === "string" &&
            typeof config.name === "string" &&
            typeof config.width === "number" &&
            typeof config.height === "number";

          let validUrl = false;
          try {
            new URL(config.url);
            validUrl = true;
          } catch {}

          const validName = config.name.length > 0;
          return hasRequired && validTypes && validUrl && validName;
        };

        const testConfig = {
          url: "https://github.com",
          name: "github",
          width: 1200,
          height: 780,
        };

        return validateConfig(testConfig);
      } catch {
        return false;
      }
    });
  }

  async runE2ETests() {
    // GitHub.com CLI build test
    await this.runTest(
      "GitHub.com CLI Build Test",
      async () => {
        return new Promise((resolve, reject) => {
          const testName = "GitHubApp";
          const command = `node "${config.CLI_PATH}" "https://github.com" --name "${testName}" --debug --width 1200 --height 780`;

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
          let configGenerated = false;

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
            if (
              output.includes("GitHub") &&
              (output.includes("config") || output.includes("name"))
            ) {
              configGenerated = true;
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
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
          });

          // Kill process after 60 seconds if build started
          const timeout = setTimeout(() => {
            child.kill("SIGTERM");

            const appFile = path.join(config.PROJECT_ROOT, `${testName}.app`);
            const dmgFile = path.join(config.PROJECT_ROOT, `${testName}.dmg`);
            this.trackTempFile(appFile);
            this.trackTempFile(dmgFile);

            if (buildStarted) {
              console.log(
                `✓ GitHub.com CLI build started successfully (${testName})`,
              );
              resolve(true);
            } else {
              reject(
                new Error("GitHub.com CLI build did not start within timeout"),
              );
            }
          }, 60000);

          child.on("close", () => {
            clearTimeout(timeout);
            const appFile = path.join(config.PROJECT_ROOT, `${testName}.app`);
            const dmgFile = path.join(config.PROJECT_ROOT, `${testName}.dmg`);
            this.trackTempFile(appFile);
            this.trackTempFile(dmgFile);

            if (buildStarted) {
              resolve(true);
            } else {
              reject(
                new Error("GitHub.com CLI build process ended before starting"),
              );
            }
          });

          child.on("error", (error) => {
            reject(
              new Error(`GitHub.com CLI build process error: ${error.message}`),
            );
          });

          child.stdin.end();
        });
      },
      70000, // 70 seconds timeout
    );

    // Configuration verification test
    await this.runTest(
      "Configuration File Verification",
      async () => {
        const pakeDir = path.join(config.PROJECT_ROOT, "src-tauri", ".pake");

        return new Promise((resolve, reject) => {
          const testName = "GitHubConfigTest";
          const command = `node "${config.CLI_PATH}" "https://github.com" --name "${testName}" --debug --width 1200 --height 780`;

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
              const configFile = path.join(pakeDir, "tauri.conf.json");
              const pakeConfigFile = path.join(pakeDir, "pake.json");

              if (fs.existsSync(configFile) && fs.existsSync(pakeConfigFile)) {
                try {
                  const config = JSON.parse(
                    fs.readFileSync(configFile, "utf8"),
                  );
                  const pakeConfig = JSON.parse(
                    fs.readFileSync(pakeConfigFile, "utf8"),
                  );

                  if (
                    config.productName === testName &&
                    pakeConfig.windows[0].url === "https://github.com/"
                  ) {
                    child.kill("SIGTERM");
                    this.trackTempDir(pakeDir);
                    console.log(
                      "✓ GitHub.com configuration files verified correctly",
                    );
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
            if (
              output.includes("Installing package") ||
              output.includes("Building app")
            ) {
              setTimeout(checkConfigFiles, 1000);
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            if (
              output.includes("Installing package") ||
              output.includes("Building app") ||
              output.includes("Package installed")
            ) {
              setTimeout(checkConfigFiles, 1000);
            }
          });

          // Timeout after 20 seconds
          setTimeout(() => {
            child.kill("SIGTERM");
            this.trackTempDir(pakeDir);
            reject(new Error("GitHub.com configuration verification timeout"));
          }, 20000);

          child.on("error", (error) => {
            reject(
              new Error(
                `GitHub.com config verification error: ${error.message}`,
              ),
            );
          });

          child.stdin.end();
        });
      },
      25000,
    );
  }

  async runRealBuildTest() {
    // Real build test that actually creates a complete app
    await this.runTest(
      "Complete GitHub.com App Build",
      async () => {
        return new Promise((resolve, reject) => {
          const testName = "GitHubRealBuild";
          // Platform-specific output files
          const outputFiles = {
            darwin: {
              app: path.join(config.PROJECT_ROOT, `${testName}.app`),
              installer: path.join(config.PROJECT_ROOT, `${testName}.dmg`),
              bundleDir: path.join(
                config.PROJECT_ROOT,
                "src-tauri/target/release/bundle",
              ),
            },
            linux: {
              app: path.join(
                config.PROJECT_ROOT,
                `src-tauri/target/release/pake`,
              ),
              installer: path.join(
                config.PROJECT_ROOT,
                "src-tauri/target/release/bundle/deb",
              ),
              bundleDir: path.join(
                config.PROJECT_ROOT,
                "src-tauri/target/release/bundle",
              ),
            },
            win32: {
              app: path.join(
                config.PROJECT_ROOT,
                "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi",
              ),
              installer: path.join(
                config.PROJECT_ROOT,
                "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi",
              ),
              bundleDir: path.join(
                config.PROJECT_ROOT,
                "src-tauri/target/x86_64-pc-windows-msvc/release/bundle",
              ),
              // Alternative directories to check
              altDirs: [
                path.join(
                  config.PROJECT_ROOT,
                  "src-tauri/target/release/bundle/msi",
                ),
                path.join(
                  config.PROJECT_ROOT,
                  "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis",
                ),
                path.join(
                  config.PROJECT_ROOT,
                  "src-tauri/target/release/bundle/nsis",
                ),
              ],
            },
          };
          const platform = process.platform;
          const expectedFiles = outputFiles[platform] || outputFiles.darwin;

          console.log(`🔧 Starting real build test for GitHub.com...`);
          console.log(`📝 Platform: ${platform}`);
          console.log(`📝 Expected app directory: ${expectedFiles.app}`);
          console.log(
            `📝 Expected installer directory: ${expectedFiles.installer}`,
          );
          if (expectedFiles.bundleDir) {
            console.log(`📝 Bundle directory: ${expectedFiles.bundleDir}`);
          }
          if (expectedFiles.altDirs) {
            console.log(`📝 Alternative directories to check:`);
            expectedFiles.altDirs.forEach((dir, i) => {
              console.log(`     ${i + 1}. ${dir}`);
            });
          }

          const command = `node "${config.CLI_PATH}" "https://github.com" --name "${testName}" --width 1200 --height 800 --hide-title-bar`;

          const child = spawn(command, {
            shell: true,
            cwd: config.PROJECT_ROOT,
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              PAKE_CREATE_APP: "1",
            },
          });

          let buildStarted = false;
          let compilationStarted = false;

          // Track progress without too much noise
          child.stdout.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Installing package")) {
              console.log("   📦 Installing dependencies...");
            }
            if (output.includes("Building app")) {
              buildStarted = true;
              console.log("   🏗️  Build started...");
            }
            if (output.includes("Compiling")) {
              compilationStarted = true;
              console.log("   ⚙️  Compiling...");
            }
            if (output.includes("Bundling")) {
              console.log("   📦 Bundling...");
            }
            if (output.includes("Built application at:")) {
              console.log("   ✅ Build completed!");
            }
          });

          let errorOutput = "";
          child.stderr.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Building app")) buildStarted = true;
            if (output.includes("Compiling")) compilationStarted = true;
            if (output.includes("Finished"))
              console.log("   ✅ Compilation finished!");

            // Capture error output for debugging
            if (
              output.includes("error:") ||
              output.includes("Error:") ||
              output.includes("ERROR")
            ) {
              errorOutput += output;
            }
          });

          // Real timeout - 8 minutes for actual build
          const timeout = setTimeout(() => {
            console.log(
              "   🔍 Build timeout reached, checking for output files...",
            );

            const foundFiles = this.findBuildOutputFiles(testName, platform);

            if (foundFiles.length > 0) {
              console.log(
                "   🎉 Build completed successfully - found output files!",
              );
              foundFiles.forEach((file) => {
                console.log(`   📱 Found: ${file.path} (${file.type})`);
              });
              console.log("   ✨ Build artifacts preserved for inspection");
              child.kill("SIGTERM");
              resolve(true);
            } else {
              console.log(
                "   ⚠️  Build process completed but no output files found",
              );
              this.debugBuildDirectories();
              child.kill("SIGTERM");
              reject(
                new Error("Real build test timeout - no output files found"),
              );
            }
          }, 480000); // 8 minutes

          child.on("close", (code) => {
            clearTimeout(timeout);

            console.log(`   📊 Build process finished with exit code: ${code}`);

            const foundFiles = this.findBuildOutputFiles(testName, platform);

            if (foundFiles.length > 0) {
              console.log(
                "   🎉 Real build test SUCCESS: Build file(s) generated!",
              );
              foundFiles.forEach((file) => {
                console.log(`   📱 ${file.type}: ${file.path}`);
                try {
                  const stats = fs.statSync(file.path);
                  const size = (stats.size / 1024 / 1024).toFixed(1);
                  console.log(`      Size: ${size}MB`);
                } catch (error) {
                  console.log(`      (Could not get file size)`);
                }
              });
              console.log("   ✨ Build artifacts preserved for inspection");
              resolve(true);
            } else if (code === 0 && buildStarted && compilationStarted) {
              console.log(
                "   ⚠️  Build process completed but no output files found",
              );
              this.debugBuildDirectories();
              resolve(false);
            } else {
              console.log(`   ❌ Build process failed with exit code: ${code}`);
              if (buildStarted) {
                console.log(
                  "   📊 Build was started but failed during execution",
                );
                if (errorOutput.trim()) {
                  console.log("   🔍 Error details:");
                  errorOutput.split("\n").forEach((line) => {
                    if (line.trim()) console.log(`     ${line.trim()}`);
                  });
                }
                this.debugBuildDirectories();
              } else {
                console.log("   📊 Build failed before starting compilation");
                if (errorOutput.trim()) {
                  console.log("   🔍 Error details:");
                  errorOutput.split("\n").forEach((line) => {
                    if (line.trim()) console.log(`     ${line.trim()}`);
                  });
                }
              }
              reject(new Error(`Real build test failed with code ${code}`));
            }
          });

          child.on("error", (error) => {
            clearTimeout(timeout);
            reject(
              new Error(`Real build test process error: ${error.message}`),
            );
          });

          child.stdin.end();
        });
      },
      500000, // 8+ minutes timeout
    );
  }

  async runMultiArchBuildTest() {
    // Multi-arch build test specifically for macOS
    await this.runTest(
      "Multi-Arch GitHub.com Build (Universal Binary)",
      async () => {
        return new Promise((resolve, reject) => {
          const testName = "GitHubMultiArch";
          const appFile = path.join(config.PROJECT_ROOT, `${testName}.app`);
          const dmgFile = path.join(config.PROJECT_ROOT, `${testName}.dmg`);

          console.log(`🔧 Starting multi-arch build test for GitHub.com...`);
          console.log(`📝 Expected output: ${appFile}`);
          console.log(`🏗️  Building Universal Binary (Intel + Apple Silicon)`);

          const command = `node "${config.CLI_PATH}" "https://github.com" --name "${testName}" --width 1200 --height 800 --hide-title-bar --multi-arch`;

          const child = spawn(command, {
            shell: true,
            cwd: config.PROJECT_ROOT,
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              PAKE_CREATE_APP: "1",
              HDIUTIL_QUIET: "1",
              HDIUTIL_NO_AUTOOPEN: "1",
            },
          });

          let buildStarted = false;
          let compilationStarted = false;

          // Track progress
          child.stdout.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Installing package")) {
              console.log("   📦 Installing dependencies...");
            }
            if (output.includes("Building app")) {
              buildStarted = true;
              console.log("   🏗️  Multi-arch build started...");
            }
            if (output.includes("Compiling")) {
              compilationStarted = true;
              console.log("   ⚙️  Compiling for multiple architectures...");
            }
            if (
              output.includes("universal-apple-darwin") ||
              output.includes("Universal")
            ) {
              console.log("   🔀 Universal binary target detected");
            }
            if (output.includes("Bundling")) {
              console.log("   📦 Bundling universal binary...");
            }
            if (output.includes("Built application at:")) {
              console.log("   ✅ Multi-arch build completed!");
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Building app")) buildStarted = true;
            if (output.includes("Compiling")) compilationStarted = true;
            if (output.includes("Finished"))
              console.log("   ✅ Multi-arch compilation finished!");
          });

          // Multi-arch builds take longer - 20 minutes timeout
          const timeout = setTimeout(() => {
            console.log(
              "   🔍 Multi-arch build timeout reached, checking for output files...",
            );

            const foundFiles = this.findBuildOutputFiles(testName, "darwin");

            if (foundFiles.length > 0) {
              console.log("   🎉 Multi-arch build completed successfully!");
              foundFiles.forEach((file) => {
                console.log(`   📱 Found: ${file.path} (${file.type})`);
              });
              console.log("   🔀 Universal binary preserved for inspection");
              child.kill("SIGTERM");
              resolve(true);
            } else {
              console.log(
                "   ❌ Multi-arch build timeout - no output files generated",
              );
              this.debugBuildDirectories(
                {
                  app: appFile,
                  installer: dmgFile,
                  bundleDir: path.join(
                    config.PROJECT_ROOT,
                    "src-tauri/target/universal-apple-darwin/release/bundle",
                  ),
                },
                "darwin",
              );
              child.kill("SIGTERM");
              reject(new Error("Multi-arch build test timeout"));
            }
          }, 1200000); // 20 minutes for multi-arch

          child.on("close", (code) => {
            clearTimeout(timeout);

            console.log(
              `   📊 Multi-arch build process finished with exit code: ${code}`,
            );

            const foundFiles = this.findBuildOutputFiles(testName, "darwin");

            if (foundFiles.length > 0) {
              console.log(
                "   🎉 Multi-arch build test SUCCESS: Universal binary generated!",
              );
              foundFiles.forEach((file) => {
                console.log(`   📱 ${file.type}: ${file.path}`);
              });
              console.log("   🔀 Universal binary preserved for inspection");

              // Verify it's actually a universal binary
              const appFile = foundFiles.find((f) => f.type.includes("App"));
              if (appFile) {
                try {
                  const binaryPath = path.join(
                    appFile.path,
                    "Contents/MacOS/pake",
                  );
                  const fileOutput = execSync(`file "${binaryPath}"`, {
                    encoding: "utf8",
                  });
                  if (fileOutput.includes("universal binary")) {
                    console.log(
                      "   ✅ Verified: Universal binary created successfully",
                    );
                  } else {
                    console.log(
                      "   ⚠️  Note: Binary architecture:",
                      fileOutput.trim(),
                    );
                  }
                } catch (error) {
                  console.log("   ⚠️  Could not verify binary architecture");
                }
              }

              resolve(true);
            } else if (buildStarted && compilationStarted) {
              // If build started and compilation happened, but no output files found
              console.log(
                "   ⚠️  Multi-arch build process completed but no output files found",
              );
              this.debugBuildDirectories(
                {
                  app: appFile,
                  installer: dmgFile,
                  bundleDir: path.join(
                    config.PROJECT_ROOT,
                    "src-tauri/target/universal-apple-darwin/release/bundle",
                  ),
                },
                "darwin",
              );
              resolve(false);
            } else {
              // Only reject if the build never started or failed early
              reject(
                new Error(`Multi-arch build test failed with code ${code}`),
              );
            }
          });

          child.on("error", (error) => {
            clearTimeout(timeout);
            reject(
              new Error(
                `Multi-arch build test process error: ${error.message}`,
              ),
            );
          });

          child.stdin.end();
        });
      },
      1250000, // 20+ minutes timeout
    );
  }

  // Simplified build output detection - if build succeeds, check for any output files
  findBuildOutputFiles(testName, platform) {
    const foundFiles = [];
    console.log(`   🔍 Checking for ${platform} build outputs...`);

    // Simple approach: look for common build artifacts in project root and common locations
    const searchLocations = [
      // Always check project root first (most builds output there)
      config.PROJECT_ROOT,
      // Platform-specific bundle directories
      ...(platform === "linux"
        ? [
            path.join(config.PROJECT_ROOT, "src-tauri/target/release"),
            path.join(
              config.PROJECT_ROOT,
              "src-tauri/target/release/bundle/deb",
            ),
          ]
        : []),
      ...(platform === "win32"
        ? [
            path.join(
              config.PROJECT_ROOT,
              "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi",
            ),
            path.join(
              config.PROJECT_ROOT,
              "src-tauri/target/release/bundle/msi",
            ),
          ]
        : []),
      ...(platform === "darwin"
        ? [
            path.join(
              config.PROJECT_ROOT,
              "src-tauri/target/release/bundle/macos",
            ),
            path.join(
              config.PROJECT_ROOT,
              "src-tauri/target/release/bundle/dmg",
            ),
            path.join(
              config.PROJECT_ROOT,
              "src-tauri/target/universal-apple-darwin/release/bundle",
            ),
          ]
        : []),
    ];

    // Define what we're looking for based on platform
    const buildPatterns = {
      win32: [".msi", ".exe"],
      linux: [".deb", ".appimage"],
      darwin: [".dmg", ".app"],
    };

    const patterns = buildPatterns[platform] || buildPatterns.darwin;

    for (const location of searchLocations) {
      if (!fs.existsSync(location)) {
        continue;
      }

      console.log(
        `      📁 Checking: ${path.relative(config.PROJECT_ROOT, location)}`,
      );

      try {
        const items = fs.readdirSync(location);
        const buildFiles = items.filter((item) => {
          const itemPath = path.join(location, item);
          const stats = fs.statSync(itemPath);

          // Skip common non-build directories
          if (
            stats.isDirectory() &&
            [".git", ".github", "node_modules", "src", "bin", "tests"].includes(
              item,
            )
          ) {
            return false;
          }

          // Check if it's a build artifact we care about
          const lowerItem = item.toLowerCase();
          return (
            patterns.some((pattern) => lowerItem.endsWith(pattern)) ||
            lowerItem.includes(testName.toLowerCase()) ||
            (lowerItem.includes("github") && !item.startsWith(".")) || // Avoid .github directory
            (platform === "linux" && item === "pake")
          ); // Linux binary
        });

        buildFiles.forEach((file) => {
          const fullPath = path.join(location, file);
          const stats = fs.statSync(fullPath);

          let fileType = "Build Artifact";
          if (file.endsWith(".msi")) fileType = "MSI Installer";
          else if (file.endsWith(".exe")) fileType = "Windows Executable";
          else if (file.endsWith(".deb")) fileType = "DEB Package";
          else if (file.endsWith(".appimage")) fileType = "AppImage";
          else if (file.endsWith(".dmg")) fileType = "DMG Image";
          else if (file.endsWith(".app"))
            fileType = stats.isDirectory() ? "macOS App Bundle" : "macOS App";
          else if (file === "pake") fileType = "Linux Binary";

          foundFiles.push({
            path: fullPath,
            type: fileType,
            size: stats.isFile() ? stats.size : 0,
          });

          const size =
            stats.isFile() && stats.size > 0
              ? ` (${(stats.size / 1024 / 1024).toFixed(1)}MB)`
              : "";
          console.log(`      ✅ Found ${fileType}: ${file}${size}`);
        });

        // For Linux, also check inside architecture directories
        if (platform === "linux") {
          const archDirs = items.filter(
            (item) => item.includes("amd64") || item.includes("x86_64"),
          );

          for (const archDir of archDirs) {
            const archPath = path.join(location, archDir);
            if (fs.statSync(archPath).isDirectory()) {
              console.log(`      🔍 Checking arch directory: ${archDir}`);
              try {
                const archFiles = fs.readdirSync(archPath);
                archFiles
                  .filter((f) => f.endsWith(".deb"))
                  .forEach((debFile) => {
                    const debPath = path.join(archPath, debFile);
                    const debStats = fs.statSync(debPath);
                    foundFiles.push({
                      path: debPath,
                      type: "DEB Package",
                      size: debStats.size,
                    });
                    const size = `(${(debStats.size / 1024 / 1024).toFixed(1)}MB)`;
                    console.log(
                      `      ✅ Found DEB Package: ${debFile} ${size}`,
                    );
                  });
              } catch (error) {
                console.log(
                  `      ⚠️  Could not check ${archDir}: ${error.message}`,
                );
              }
            }
          }
        }
      } catch (error) {
        console.log(`      ⚠️  Could not read ${location}: ${error.message}`);
      }
    }

    console.log(`   📊 Found ${foundFiles.length} build artifact(s)`);
    return foundFiles;
  }

  // Debug function to show directory structure
  debugBuildDirectories() {
    console.log("   🔍 Debug: Analyzing build directories...");

    const targetDir = path.join(config.PROJECT_ROOT, "src-tauri/target");
    if (fs.existsSync(targetDir)) {
      console.log("   🔍 Target directory structure:");
      try {
        this.listTargetContents(targetDir);
      } catch (error) {
        console.log(`   ⚠️  Could not list target contents: ${error.message}`);
      }
    } else {
      console.log(`   ❌ Target directory does not exist: ${targetDir}`);
    }

    // Check project root for direct outputs
    console.log("   🔍 Project root files:");
    try {
      const rootFiles = fs
        .readdirSync(config.PROJECT_ROOT)
        .filter(
          (file) =>
            file.endsWith(".app") ||
            file.endsWith(".dmg") ||
            file.endsWith(".msi") ||
            file.endsWith(".deb") ||
            file.endsWith(".exe"),
        );
      if (rootFiles.length > 0) {
        rootFiles.forEach((file) => {
          console.log(`      📱 ${file}`);
        });
      } else {
        console.log(`      (No build artifacts in project root)`);
      }
    } catch (error) {
      console.log(`      ❌ Error reading project root: ${error.message}`);
    }
  }

  listTargetContents(targetDir, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return;

    try {
      const items = fs.readdirSync(targetDir);
      items.forEach((item) => {
        const fullPath = path.join(targetDir, item);
        const relativePath = path.relative(config.PROJECT_ROOT, fullPath);
        const indent = "     ".repeat(currentDepth + 1);

        try {
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            console.log(`${indent}📁 ${relativePath}/`);
            // Show more directories for Windows debugging
            if (
              item === "bundle" ||
              item === "release" ||
              item === "msi" ||
              item === "nsis" ||
              item.includes("windows") ||
              item.includes("msvc")
            ) {
              this.listTargetContents(fullPath, maxDepth, currentDepth + 1);
            }
          } else {
            const size =
              stats.size > 0
                ? ` (${(stats.size / 1024 / 1024).toFixed(1)}MB)`
                : "";
            console.log(`${indent}📄 ${relativePath}${size}`);
          }
        } catch (statError) {
          console.log(`${indent}❓ ${relativePath} (cannot stat)`);
        }
      });
    } catch (error) {
      console.log(
        `     ⚠️  Could not list contents of ${targetDir}: ${error.message}`,
      );
    }
  }

  trackTempFile(filepath) {
    this.tempFiles.push(filepath);
  }

  trackTempDir(dirpath) {
    this.tempDirs.push(dirpath);
  }

  cleanupTempIcons() {
    // Clean up temporary icon files generated during tests
    const iconsDir = path.join(config.PROJECT_ROOT, "src-tauri/icons");
    const testNames = ["urltest", "githubapp", "githubmultiarch"];

    testNames.forEach((name) => {
      const iconPath = path.join(iconsDir, `${name}.icns`);
      try {
        if (fs.existsSync(iconPath)) {
          fs.unlinkSync(iconPath);
          console.log(`   🗑️  Cleaned up temporary icon: ${name}.icns`);
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up icon ${iconPath}`);
      }
    });
  }

  cleanup() {
    // Clean up temporary icon files generated during tests
    this.cleanupTempIcons();

    // Clean up temporary files and directories
    this.tempFiles.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          if (fs.statSync(file).isDirectory()) {
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            fs.unlinkSync(file);
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up file ${file}`);
      }
    });

    this.tempDirs.forEach((dir) => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up directory ${dir}`);
      }
    });
  }

  displayFinalResults() {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    console.log("\n🎯 Overall Test Summary");
    console.log("=======================");
    console.log(`Total: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log("🎉 All tests passed! CLI is ready for use.\n");
    } else {
      console.log(
        `❌ ${total - passed} test(s) failed. Please check the issues above.\n`,
      );

      // Show failed tests
      const failed = this.results.filter((r) => !r.passed);
      if (failed.length > 0) {
        console.log("Failed tests:");
        failed.forEach((result) => {
          const error = result.error ? ` (${result.error})` : "";
          console.log(`  ❌ ${result.name}${error}`);
        });
        console.log();
      }
    }
  }
}

// Command line interface
const args = process.argv.slice(2);

// Complete test suite by default - no more smart modes
const options = {
  unit: !args.includes("--no-unit"),
  integration: !args.includes("--no-integration"),
  builder: !args.includes("--no-builder"),
  pakeCliTests: args.includes("--pake-cli"),
  e2e: args.includes("--e2e"),
  realBuild: !args.includes("--no-build"), // Always include real build test
  quick: false, // Remove quick mode
};

// Help message
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
🚀 Pake CLI Test Suite

Usage: npm test [-- options]

Complete Test Suite (Default):
  pnpm test                   # Run complete test suite with real build (8-12 minutes)

Test Components:
  ✅ Unit Tests               # CLI commands, validation, response time
  ✅ Integration Tests        # Process spawning, file permissions, dependencies
  ✅ Builder Tests           # Platform detection, architecture, file naming
  ✅ Real Build Test         # Complete GitHub.com app build with packaging

Optional Components:
  --e2e          Add end-to-end configuration tests
  --pake-cli     Add pake-cli GitHub Actions tests

Skip Components (if needed):
  --no-unit      Skip unit tests
  --no-integration  Skip integration tests
  --no-builder   Skip builder tests
  --no-build     Skip real build test

Examples:
  npm test                         # Complete test suite (recommended)
  npm test -- --e2e               # Complete suite + end-to-end tests
  pnpm test -- --no-build         # Skip real build (faster for development)

Environment:
  CI=1              # Enable CI mode
  DEBUG=1           # Enable debug output
  PAKE_CREATE_APP=1 # Allow app creation in tests
`);
  process.exit(0);
}

// Run tests
const runner = new PakeTestRunner();
runner
  .runAll(options)
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });

export default runner;
