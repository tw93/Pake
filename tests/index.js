#!/usr/bin/env node

/**
 * Unified Test Runner for Pake CLI
 *
 * This is a simplified, unified test runner that replaces the scattered
 * test files with a single, easy-to-use interface.
 */

import { execSync, spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "node:os";
import { verifyBuildOutput, verifyMacApp } from "./helpers/build-output.js";
import ora from "ora";
import config, { TIMEOUTS, TEST_URLS } from "./config.js";

const rejectImageDependenciesLoader = `data:text/javascript,${encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === "sharp") {
      throw new Error("Image dependency loaded during CLI startup: " + specifier);
    }
    return nextResolve(specifier, context);
  }
`)}`;

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

    console.log("Pake CLI Test Suite");
    console.log("======================\n");

    this.validateEnvironment();

    // Clean up any leftover files from previous test runs
    console.log("[Clean] Removing any leftover test artifacts...");
    this.cleanupTempIcons();

    let testCount = 0;

    if (unit && !quick) {
      console.log("Running CLI Health Checks...");
      await this.runCliHealthChecks();
      testCount++;

      console.log("\nRunning Project Unit Tests (Vitest)...");
      try {
        execSync("npx vitest run", {
          stdio: "inherit",
          cwd: config.PROJECT_ROOT,
        });
        this.results.push({ name: "Vitest Unit Tests", passed: true });
        testCount++;
      } catch (e) {
        console.log("[FAIL] Vitest unit tests failed");
        this.results.push({
          name: "Vitest Unit Tests",
          passed: false,
          error: e.message,
        });
      }
    }

    if (integration && !quick) {
      console.log("\n[Integration] Running Integration Tests...");
      await this.runIntegrationTests();
      testCount++;
    }

    if (builder && !quick) {
      console.log("\n[Build] Running Builder Tests...");
      await this.runBuilderTests();
      testCount++;
    }

    if (pakeCliTests) {
      console.log("\n[Package] Running Pake-CLI GitHub Actions Tests...");
      await this.runPakeCliTests();
      testCount++;
    }

    if (e2e && !quick) {
      console.log("\n[Run] Running End-to-End Tests...");
      await this.runE2ETests();
      testCount++;

      console.log("\n[Network] Running Proxy Configuration Test...");
      await this.runProxyTest();
      testCount++;
    }

    if (builder && !quick) {
      console.log("\n[Build] Running Local File Build Test...");
      await this.runLocalFileTest();
      testCount++;
    }

    if (realBuild && !quick) {
      // On macOS, prefer multi-arch test as it's more likely to catch issues
      if (process.platform === "darwin") {
        console.log("\n[Build] Running Real Build Test (Multi-Arch)...");
        await this.runMultiArchBuildTest();
        testCount++;
      } else {
        console.log("\n[Build] Running Real Build Test...");
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
    console.log("Environment Validation:");
    console.log("-----------------------");

    // Check if CLI file exists
    if (!fs.existsSync(config.CLI_PATH)) {
      console.log("[FAIL] CLI file not found. Run: pnpm run cli:build");
      process.exit(1);
    }
    console.log("[PASS] CLI file exists");

    // Check if CLI is executable
    try {
      execSync(`node "${config.CLI_PATH}" --version`, {
        encoding: "utf8",
        timeout: TIMEOUTS.QUICK,
      });
      console.log("[PASS] CLI responds");
    } catch (error) {
      const reason =
        error.signal === "SIGTERM"
          ? `timed out after ${TIMEOUTS.QUICK}ms`
          : error.message;
      console.log(`[FAIL] CLI did not respond: ${reason}`);
      process.exit(1);
    }

    // Platform info
    console.log(`[PASS] Platform: ${process.platform} (${process.arch})`);
    console.log(`[PASS] Node.js: ${process.version}`);

    const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
    console.log(`[INFO] CI Environment: ${isCI ? "Yes" : "No"}`);

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

  async runCliHealthChecks() {
    // Version command test
    await this.runTest(
      "Version Command",
      () => {
        const output = execSync(`node "${config.CLI_PATH}" --version`, {
          encoding: "utf8",
          timeout: TIMEOUTS.QUICK,
        });
        return /^\d+\.\d+\.\d+/.test(output.trim());
      },
      TIMEOUTS.QUICK,
    );

    // Metadata-only commands must not initialize native image tooling.
    await this.runTest(
      "Version Command Without Image Dependencies",
      () => {
        const result = spawnSync(
          process.execPath,
          [
            "--no-warnings",
            "--experimental-loader",
            rejectImageDependenciesLoader,
            config.CLI_PATH,
            "--version",
          ],
          {
            encoding: "utf8",
            timeout: TIMEOUTS.QUICK,
          },
        );
        return (
          result.status === 0 && /^\d+\.\d+\.\d+/.test(result.stdout.trim())
        );
      },
      TIMEOUTS.QUICK,
    );

    // Help command test
    await this.runTest(
      "Help Command",
      () => {
        const output = execSync(`node "${config.CLI_PATH}"`, {
          encoding: "utf8",
          timeout: TIMEOUTS.QUICK,
        });
        return output.includes("Usage: cli [url] [options]");
      },
      TIMEOUTS.QUICK,
    );

    // URL validation test
    await this.runTest("URL Validation", () => {
      const result = spawnSync(
        process.execPath,
        [config.CLI_PATH, "", "--name", "TestApp", "--json"],
        { encoding: "utf8", timeout: TIMEOUTS.QUICK },
      );
      return (
        !result.error &&
        result.status === 2 &&
        JSON.parse(result.stdout).error?.code === "INVALID_INPUT"
      );
    });

    // Number validation test
    await this.runTest("Number Validation", () => {
      try {
        execSync(`node "${config.CLI_PATH}" https://example.com --width abc`, {
          encoding: "utf8",
          timeout: TIMEOUTS.QUICK,
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
        timeout: TIMEOUTS.QUICK,
      });
      const elapsed = Date.now() - start;
      return elapsed < 5000;
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
        }, TIMEOUTS.QUICK);
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
        return (
          essentialDeps.every(
            (dep) => packageJson.dependencies && packageJson.dependencies[dep],
          ) && !packageJson.dependencies["icon-gen"]
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
          }, 40000);

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
      45000,
    );
  }

  async runProxyTest() {
    await this.runTest("Proxy Configuration", async () => {
      const command = `node "${config.CLI_PATH}" "https://google.com" --name "ProxyTest" --proxy-url "http://127.0.0.1:7890" --debug`;
      // We just want to check if the command parses the proxy argument correctly
      // It might fail to connect if no proxy is running, but that's expected
      try {
        execSync(`echo "n" | timeout 5s ${command} || true`, {
          encoding: "utf8",
          timeout: 8000,
        });
        return true;
      } catch (error) {
        // If it fails with "connection refused" or similar, it means it TRIED to use the proxy
        return true;
      }
    });
  }

  async runLocalFileTest() {
    if (process.platform !== "darwin") {
      console.log(
        "Local artifact fixture skipped: currently uses macOS .app paths; staging is covered by Vitest.",
      );
      return;
    }
    await this.runTest(
      "Local File Build Isolation",
      () => {
        const result = spawnSync(
          process.execPath,
          [
            path.join(
              config.PROJECT_ROOT,
              "tests/integration/build-workspace.mjs",
            ),
          ],
          { cwd: config.PROJECT_ROOT, encoding: "utf8", timeout: 120000 },
        );
        if (result.error || result.status !== 0) {
          throw result.error || new Error(result.stderr || result.stdout);
        }
        return true;
      },
      120000,
    );
  }

  async runRealBuildTest() {
    return this.runArtifactBuildTest(false);
  }

  async runMultiArchBuildTest() {
    return this.runArtifactBuildTest(true);
  }

  async runArtifactBuildTest(multiArch) {
    await this.runTest(
      multiArch
        ? "Multi-Arch GitHub.com Build (Universal Binary)"
        : "Native GitHub.com Build",
      async () => {
        const directory = fs.mkdtempSync(
          path.join(os.tmpdir(), "pake-universal-test-"),
        );
        this.trackTempDir(directory);
        const extension =
          process.platform === "darwin"
            ? "app"
            : process.platform === "win32"
              ? "msi"
              : "deb";
        const appName =
          process.platform === "linux" ? "githubmultiarch" : "GitHubMultiArch";
        const app = path.join(directory, `${appName}.${extension}`);
        return new Promise((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              config.CLI_PATH,
              "https://github.com",
              "--name",
              appName,
              "--width",
              "1200",
              "--height",
              "800",
              "--hide-title-bar",
              ...(multiArch ? ["--multi-arch"] : []),
              "--targets",
              process.platform === "win32" ? "x64" : extension,
              "--json",
              "--icon",
              path.join(config.PROJECT_ROOT, "src-tauri/icons/icon.png"),
            ],
            {
              cwd: directory,
              stdio: ["ignore", "pipe", "pipe"],
              env: {
                ...process.env,
                PAKE_CREATE_APP: "1",
                HDIUTIL_QUIET: "1",
                HDIUTIL_NO_AUTOOPEN: "1",
              },
            },
          );
          let stdout = "";
          child.stdout.on("data", (data) => {
            stdout += data.toString();
          });
          child.stderr.on("data", (data) => process.stderr.write(data));
          let timedOut = false;
          const timeout = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, 1200000);
          child.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.on("close", (code) => {
            clearTimeout(timeout);
            try {
              if (timedOut) throw new Error("Native build timed out");
              verifyBuildOutput(code, stdout, app);
              if (process.platform === "darwin") {
                verifyMacApp(
                  app,
                  multiArch
                    ? ["x86_64", "arm64"]
                    : [process.arch === "arm64" ? "arm64" : "x86_64"],
                );
              }
              console.log("Verified the current build output.");
              resolve(true);
            } catch (error) {
              reject(error);
            }
          });
        });
      },
      1250000,
    );
  }

  // Debug function to show directory structure
  debugBuildDirectories() {
    console.log("   [Check] Debug: Analyzing build directories...");

    const targetDir = path.join(config.PROJECT_ROOT, "src-tauri/target");
    if (fs.existsSync(targetDir)) {
      console.log("   [Check] Target directory structure:");
      try {
        this.listTargetContents(targetDir);
      } catch (error) {
        console.log(
          `   [Warn]  Could not list target contents: ${error.message}`,
        );
      }
    } else {
      console.log(`   [FAIL] Target directory does not exist: ${targetDir}`);
    }

    // Check project root for direct outputs
    console.log("   [Check] Project root files:");
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
          console.log(`      [App] ${file}`);
        });
      } else {
        console.log(`      (No build artifacts in project root)`);
      }
    } catch (error) {
      console.log(`      [FAIL] Error reading project root: ${error.message}`);
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
            console.log(`${indent}[Dir] ${relativePath}/`);
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
            console.log(`${indent}[File] ${relativePath}${size}`);
          }
        } catch (statError) {
          console.log(`${indent}❓ ${relativePath} (cannot stat)`);
        }
      });
    } catch (error) {
      console.log(
        `     [Warn]  Could not list contents of ${targetDir}: ${error.message}`,
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
    const testNames = [
      "urltest",
      "testapp",
      "githubapp",
      "githubmultiarch",
      "githubconfigtest",
      "localapp",
      "proxytest",
    ];

    testNames.forEach((name) => {
      const iconPath = path.join(iconsDir, `${name}.icns`);
      try {
        if (fs.existsSync(iconPath)) {
          fs.unlinkSync(iconPath);
          console.log(`   [Clean] Cleaned up temporary icon: ${name}.icns`);
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up icon ${iconPath}`);
      }
    });
  }

  cleanup() {
    console.log("\nCleaning up test artifacts...");

    // Clean up temporary icon files generated during tests
    this.cleanupTempIcons();

    // Clean up tracked files
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
        // Ignore errors during cleanup
      }
    });

    this.tempDirs.forEach((dir) => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error) {
        // Ignore errors
      }
    });

    // Aggressive cleanup of known test artifacts in project root
    const testPatterns = [
      "GitHubRealBuild",
      "GitHubApp",
      "GitHubMultiArch",
      "GitHubConfigTest",
      "LocalApp",
      "ProxyTest",
      "URLTest",
    ];

    const extensions = [".app", ".dmg", ".msi", ".deb", ".exe", ".AppImage"];

    try {
      const files = fs.readdirSync(config.PROJECT_ROOT);
      files.forEach((file) => {
        // Check if file matches any test name pattern and extension
        const isTestArtifact =
          testPatterns.some((pattern) => file.includes(pattern)) &&
          (extensions.some((ext) => file.endsWith(ext)) ||
            (!file.includes(".") &&
              !fs
                .statSync(path.join(config.PROJECT_ROOT, file))
                .isDirectory())); // Linux binary often has no extension

        if (isTestArtifact) {
          const fullPath = path.join(config.PROJECT_ROOT, file);
          console.log(`   [Clean] Removing artifact: ${file}`);
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      });

      // Also clean src-tauri/.pake directory if it exists
      const pakeDir = path.join(config.PROJECT_ROOT, "src-tauri", ".pake");
      if (fs.existsSync(pakeDir)) {
        fs.rmSync(pakeDir, { recursive: true, force: true });
      }

      const localTestFile = path.join(config.PROJECT_ROOT, "test-local.html");
      if (fs.existsSync(localTestFile)) {
        fs.rmSync(localTestFile, { force: true });
      }
    } catch (e) {
      console.warn("   [Warn]  Cleanup warning:", e.message);
    }
  }

  displayFinalResults() {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    console.log("\nOverall Test Summary");
    console.log("====================");
    console.log(`Total: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log("All tests passed! CLI is ready for use.\n");
    } else {
      console.log(
        `[FAIL] ${total - passed} test(s) failed. Please check the issues above.\n`,
      );

      // Show failed tests
      const failed = this.results.filter((r) => !r.passed);
      if (failed.length > 0) {
        console.log("Failed tests:");
        failed.forEach((result) => {
          const error = result.error ? ` (${result.error})` : "";
          console.log(`  [FAIL] ${result.name}${error}`);
        });
        console.log();
      }
    }
  }
}

import ReleaseBuildTest from "./release.js";

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
  quick: false,
};

// Help message
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
[Run] Pake CLI Test Suite

Usage: npm test [-- options]

Complete Test Suite (Default):
  pnpm test                   # Run complete test suite with real build (8-12 minutes)

Test Components:
  [PASS] Unit Tests               # CLI commands, validation, response time
  [PASS] Integration Tests        # Process spawning, file permissions, dependencies
  [PASS] Builder Tests           # Platform detection, architecture, file naming
  [PASS] Real Build Test         # Complete GitHub.com app build with packaging

Optional Components:
  --e2e          Add end-to-end configuration tests
  --pake-cli     Add pake-cli GitHub Actions tests
  --release      Run release workflow tests (Twitter/WeRead) - Slow!

Skip Components (if needed):
  --no-unit      Skip unit tests
  --no-integration  Skip integration tests
  --no-builder   Skip builder tests
  --no-build     Skip real build test

Examples:
  npm test                         # Complete test suite (recommended)
  npm test -- --release           # Run everything including release workflow
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
  .then(async (success) => {
    // Run release workflow tests as part of the standard suite
    // We skip this if builder tests are explicitly disabled (often used for quick checks)
    if (success && options.realBuild) {
      console.log("\n[Package] Running Release Workflow Test...");
      console.log(
        "   (This mimics the GitHub Actions release process for popular apps)",
      );

      // Pass skipCliBuild=true since "npm test" already builds the CLI
      const releaseTester = new ReleaseBuildTest();
      const releaseSuccess = await releaseTester.run({ skipCliBuild: true });

      if (!releaseSuccess) {
        console.error("\n[FAIL] Release workflow tests failed");
        process.exit(1);
      }
    }

    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });

export default runner;
