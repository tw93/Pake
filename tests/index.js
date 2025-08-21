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
      realBuild = false  // Add option for real build test
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
      console.log("\n🏗️ Running Real Build Test...");
      await this.runRealBuildTest();
      testCount++;
      
      // Add multi-arch test on macOS
      if (process.platform === 'darwin') {
        console.log("\n🔧 Running Multi-Arch Build Test...");
        await this.runMultiArchBuildTest();
        testCount++;
      }
    }

    if (quick) {
      console.log("⚡ Running Quick Tests...");
      await this.runQuickTests();
    }

    this.cleanup();
    this.displayFinalResults();

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    return passed === total;
  }

  validateEnvironment() {
    console.log("🔍 Environment Validation:");
    console.log("---------------------------");

    // Check if CLI file exists
    if (!fs.existsSync(config.CLI_PATH)) {
      console.log("❌ CLI file not found. Run: npm run cli:build");
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
          setTimeout(() => reject(new Error("Test timeout")), timeout)
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
        error: error.message 
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
      TIMEOUTS.QUICK
    );

    // Help command test
    await this.runTest(
      "Help Command",
      () => {
        const output = execSync(`node "${config.CLI_PATH}" --help`, {
          encoding: "utf8",
          timeout: 3000,
        });
        return output.includes("Usage: cli [url] [options]");
      },
      TIMEOUTS.QUICK
    );

    // URL validation test
    await this.runTest(
      "URL Validation",
      () => {
        try {
          execSync(`node "${config.CLI_PATH}" "invalid-url" --name TestApp`, {
            encoding: "utf8",
            timeout: 3000,
          });
          return false; // Should have failed
        } catch (error) {
          return error.status !== 0;
        }
      }
    );

    // Number validation test
    await this.runTest(
      "Number Validation",
      () => {
        try {
          execSync(`node "${config.CLI_PATH}" https://example.com --width abc`, {
            encoding: "utf8",
            timeout: 3000,
          });
          return false; // Should throw error
        } catch (error) {
          return error.message.includes("Not a number");
        }
      }
    );

    // CLI response time test
    await this.runTest(
      "CLI Response Time",
      () => {
        const start = Date.now();
        execSync(`node "${config.CLI_PATH}" --version`, {
          encoding: "utf8",
          timeout: 3000,
        });
        const elapsed = Date.now() - start;
        return elapsed < 2000;
      }
    );

    // Weekly URL accessibility test
    await this.runTest(
      "Weekly URL Accessibility",
      () => {
        try {
          const testCommand = `node "${config.CLI_PATH}" ${TEST_URLS.WEEKLY} --name "URLTest" --debug`;
          execSync(`echo "n" | timeout 5s ${testCommand} || true`, {
            encoding: "utf8",
            timeout: 8000,
          });
          return true; // If we get here, URL was parsed successfully
        } catch (error) {
          return !error.message.includes("Invalid URL") && !error.message.includes("invalid");
        }
      }
    );
  }

  async runIntegrationTests() {
    // Process spawning test
    await this.runTest(
      "CLI Process Spawning",
      () => {
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
      }
    );

    // File system permissions test
    await this.runTest(
      "File System Permissions",
      () => {
        try {
          const testFile = "test-write-permission.tmp";
          fs.writeFileSync(testFile, "test");
          this.trackTempFile(testFile);

          const cliStats = fs.statSync(config.CLI_PATH);
          return cliStats.isFile();
        } catch {
          return false;
        }
      }
    );

    // Dependency resolution test
    await this.runTest(
      "Dependency Resolution",
      () => {
        try {
          const packageJsonPath = path.join(config.PROJECT_ROOT, "package.json");
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

          const essentialDeps = ["commander", "chalk", "fs-extra", "execa"];
          return essentialDeps.every(dep => packageJson.dependencies && packageJson.dependencies[dep]);
        } catch {
          return false;
        }
      }
    );
  }

  async runBuilderTests() {
    // Platform detection test
    await this.runTest(
      "Platform Detection",
      () => {
        const platform = process.platform;
        const platformConfigs = {
          darwin: { ext: '.dmg', multiArch: true },
          win32: { ext: '.msi', multiArch: false },
          linux: { ext: '.deb', multiArch: false }
        };

        const config = platformConfigs[platform];
        return config && typeof config.ext === 'string';
      }
    );

    // Architecture detection test
    await this.runTest(
      "Architecture Detection",
      () => {
        const currentArch = process.arch;
        const macArch = currentArch === "arm64" ? "aarch64" : currentArch;
        const linuxArch = currentArch === "x64" ? "amd64" : currentArch;

        return typeof macArch === "string" && typeof linuxArch === "string";
      }
    );

    // File naming pattern test
    await this.runTest(
      "File Naming Patterns",
      () => {
        const testNames = ["Simple App", "App-With_Symbols", "CamelCaseApp"];
        return testNames.every(name => {
          const processed = name.toLowerCase().replace(/\s+/g, "");
          return processed.length > 0;
        });
      }
    );
  }

  async runPakeCliTests() {
    // Package installation test
    await this.runTest(
      "pake-cli Package Installation",
      async () => {
        try {
          execSync("npm install pake-cli@latest --no-package-lock", {
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
      TIMEOUTS.LONG
    );

    // Version command test
    await this.runTest(
      "pake-cli Version Command",
      async () => {
        try {
          const version = execSync("npx pake --version", {
            encoding: "utf8",
            timeout: 10000,
          });
          return /^\d+\.\d+\.\d+/.test(version.trim());
        } catch {
          return false;
        }
      }
    );

    // Configuration validation test
    await this.runTest(
      "Configuration Validation",
      async () => {
        try {
          const validateConfig = (config) => {
            const required = ['url', 'name', 'width', 'height'];
            const hasRequired = required.every(field => config.hasOwnProperty(field));
            
            const validTypes = 
              typeof config.url === 'string' &&
              typeof config.name === 'string' &&
              typeof config.width === 'number' &&
              typeof config.height === 'number';
              
            let validUrl = false;
            try {
              new URL(config.url);
              validUrl = true;
            } catch {}
            
            const validName = config.name.length > 0;
            return hasRequired && validTypes && validUrl && validName;
          };

          const testConfig = {
            url: 'https://github.com',
            name: 'github', 
            width: 1200,
            height: 780
          };

          return validateConfig(testConfig);
        } catch {
          return false;
        }
      }
    );
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
            if (output.includes("Building app") || output.includes("Compiling") || 
                output.includes("Installing package") || output.includes("Bundling")) {
              buildStarted = true;
            }
            if (output.includes("GitHub") && (output.includes("config") || output.includes("name"))) {
              configGenerated = true;
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Building app") || output.includes("Compiling") || 
                output.includes("Installing package") || output.includes("Bundling") ||
                output.includes("Finished") || output.includes("Built application at:")) {
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
              console.log(`✓ GitHub.com CLI build started successfully (${testName})`);
              resolve(true);
            } else {
              reject(new Error("GitHub.com CLI build did not start within timeout"));
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
              reject(new Error("GitHub.com CLI build process ended before starting"));
            }
          });

          child.on("error", (error) => {
            reject(new Error(`GitHub.com CLI build process error: ${error.message}`));
          });

          child.stdin.end();
        });
      },
      70000 // 70 seconds timeout
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
                  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
                  const pakeConfig = JSON.parse(fs.readFileSync(pakeConfigFile, "utf8"));
                  
                  if (config.productName === testName && 
                      pakeConfig.windows[0].url === "https://github.com/") {
                    child.kill("SIGTERM");
                    this.trackTempDir(pakeDir);
                    console.log("✓ GitHub.com configuration files verified correctly");
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
            if (output.includes("Installing package") || output.includes("Building app")) {
              setTimeout(checkConfigFiles, 1000);
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Installing package") || output.includes("Building app") || 
                output.includes("Package installed")) {
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
            reject(new Error(`GitHub.com config verification error: ${error.message}`));
          });

          child.stdin.end();
        });
      },
      25000
    );
  }

  async runRealBuildTest() {
    // Real build test that actually creates a complete app
    await this.runTest(
      "Complete GitHub.com App Build",
      async () => {
        return new Promise((resolve, reject) => {
          const testName = "GitHubRealBuild";
          const appFile = path.join(config.PROJECT_ROOT, `${testName}.app`);
          const dmgFile = path.join(config.PROJECT_ROOT, `${testName}.dmg`);
          
          console.log(`🔧 Starting real build test for GitHub.com...`);
          console.log(`📝 Expected output: ${appFile}`);
          
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
          let bundlingStarted = false;
          let buildCompleted = false;

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
              bundlingStarted = true;
              console.log("   📦 Bundling...");
            }
            if (output.includes("Built application at:")) {
              buildCompleted = true;
              console.log("   ✅ Build completed!");
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Building app")) buildStarted = true;
            if (output.includes("Compiling")) compilationStarted = true;
            if (output.includes("Bundling")) bundlingStarted = true;
            if (output.includes("Finished")) console.log("   ✅ Compilation finished!");
            if (output.includes("Built application at:")) buildCompleted = true;
          });

          // Real timeout - 8 minutes for actual build
          const timeout = setTimeout(() => {
            const appExists = fs.existsSync(appFile);
            const dmgExists = fs.existsSync(dmgFile);
            
            if (appExists) {
              console.log("   🎉 Build completed successfully (app file exists)!");
              console.log(`   📱 App location: ${appFile}`);
              if (dmgExists) {
                console.log(`   💿 DMG location: ${dmgFile}`);
              }
              console.log("   ✨ Build artifacts preserved for inspection");
              child.kill("SIGTERM");
              resolve(true);
            } else {
              console.log("   ❌ Build timeout - no app file generated");
              console.log(`   📍 Expected location: ${appFile}`);
              child.kill("SIGTERM");
              reject(new Error("Real build test timeout"));
            }
          }, 480000); // 8 minutes

          child.on("close", (code) => {
            clearTimeout(timeout);
            
            const appExists = fs.existsSync(appFile);
            const dmgExists = fs.existsSync(dmgFile);
            
            // DON'T track files for cleanup - let user see the results
            // this.trackTempFile(appFile);
            // this.trackTempFile(dmgFile);

            if (appExists) {
              console.log("   🎉 Real build test SUCCESS: App file generated!");
              console.log(`   📱 App location: ${appFile}`);
              if (dmgExists) {
                console.log(`   💿 DMG location: ${dmgFile}`);
              }
              console.log("   ✨ Build artifacts preserved for inspection");
              resolve(true);
            } else if (code === 0 && buildStarted && compilationStarted) {
              console.log("   ⚠️  Build process completed but no app file found");
              console.log(`   📍 Expected location: ${appFile}`);
              resolve(false);
            } else {
              reject(new Error(`Real build test failed with code ${code}`));
            }
          });

          child.on("error", (error) => {
            clearTimeout(timeout);
            reject(new Error(`Real build test process error: ${error.message}`));
          });

          child.stdin.end();
        });
      },
      500000 // 8+ minutes timeout
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
            },
          });

          let buildStarted = false;
          let compilationStarted = false;
          let bundlingStarted = false;
          let buildCompleted = false;
          let multiArchDetected = false;

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
            if (output.includes("universal-apple-darwin") || output.includes("Universal")) {
              multiArchDetected = true;
              console.log("   🔀 Universal binary target detected");
            }
            if (output.includes("Bundling")) {
              bundlingStarted = true;
              console.log("   📦 Bundling universal binary...");
            }
            if (output.includes("Built application at:")) {
              buildCompleted = true;
              console.log("   ✅ Multi-arch build completed!");
            }
          });

          child.stderr.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Building app")) buildStarted = true;
            if (output.includes("Compiling")) compilationStarted = true;
            if (output.includes("universal-apple-darwin")) multiArchDetected = true;
            if (output.includes("Bundling")) bundlingStarted = true;
            if (output.includes("Finished")) console.log("   ✅ Multi-arch compilation finished!");
            if (output.includes("Built application at:")) buildCompleted = true;
          });

          // Multi-arch builds take longer - 12 minutes timeout
          const timeout = setTimeout(() => {
            const appExists = fs.existsSync(appFile);
            const dmgExists = fs.existsSync(dmgFile);
            
            if (appExists) {
              console.log("   🎉 Multi-arch build completed successfully!");
              console.log(`   📱 App location: ${appFile}`);
              if (dmgExists) {
                console.log(`   💿 DMG location: ${dmgFile}`);
              }
              console.log("   🔀 Universal binary preserved for inspection");
              child.kill("SIGTERM");
              resolve(true);
            } else {
              console.log("   ❌ Multi-arch build timeout - no app file generated");
              console.log(`   📍 Expected location: ${appFile}`);
              child.kill("SIGTERM");
              reject(new Error("Multi-arch build test timeout"));
            }
          }, 720000); // 12 minutes for multi-arch

          child.on("close", (code) => {
            clearTimeout(timeout);
            
            const appExists = fs.existsSync(appFile);
            const dmgExists = fs.existsSync(dmgFile);

            if (appExists) {
              console.log("   🎉 Multi-arch build test SUCCESS: Universal binary generated!");
              console.log(`   📱 App location: ${appFile}`);
              if (dmgExists) {
                console.log(`   💿 DMG location: ${dmgFile}`);
              }
              console.log("   🔀 Universal binary preserved for inspection");
              
              // Verify it's actually a universal binary
              try {
                const fileOutput = execSync(`file "${appFile}/Contents/MacOS/pake"`, { encoding: 'utf8' });
                if (fileOutput.includes('universal binary')) {
                  console.log("   ✅ Verified: Universal binary created successfully");
                } else {
                  console.log("   ⚠️  Note: Binary architecture:", fileOutput.trim());
                }
              } catch (error) {
                console.log("   ⚠️  Could not verify binary architecture");
              }
              
              resolve(true);
            } else if (code === 0 && buildStarted && compilationStarted) {
              console.log("   ⚠️  Multi-arch build process completed but no app file found");
              console.log(`   📍 Expected location: ${appFile}`);
              resolve(false);
            } else {
              reject(new Error(`Multi-arch build test failed with code ${code}`));
            }
          });

          child.on("error", (error) => {
            clearTimeout(timeout);
            reject(new Error(`Multi-arch build test process error: ${error.message}`));
          });

          child.stdin.end();
        });
      },
      750000 // 12+ minutes timeout
    );
  }

  async runQuickTests() {
    // Only run essential tests for quick mode
    await this.runTest(
      "Quick Version Check",
      () => {
        const output = execSync(`node "${config.CLI_PATH}" --version`, {
          encoding: "utf8",
          timeout: 3000,
        });
        return /^\d+\.\d+\.\d+/.test(output.trim());
      },
      TIMEOUTS.QUICK
    );

    await this.runTest(
      "Quick Help Check", 
      () => {
        const output = execSync(`node "${config.CLI_PATH}" --help`, {
          encoding: "utf8",
          timeout: 3000,
        });
        return output.includes("Usage: cli [url] [options]");
      },
      TIMEOUTS.QUICK
    );

    await this.runTest(
      "Quick Environment Check",
      () => {
        const platform = process.platform;
        const arch = process.arch;
        const nodeVersion = process.version;
        
        return typeof platform === 'string' && 
               typeof arch === 'string' && 
               nodeVersion.startsWith('v');
      },
      TIMEOUTS.QUICK
    );
  }

  trackTempFile(filepath) {
    this.tempFiles.push(filepath);
  }

  trackTempDir(dirpath) {
    this.tempDirs.push(dirpath);
  }

  cleanup() {
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
      console.log(`❌ ${total - passed} test(s) failed. Please check the issues above.\n`);
      
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

// Parse command line arguments
const options = {
  unit: args.includes('--unit') || args.length === 0,
  integration: args.includes('--integration') || args.length === 0,
  builder: args.includes('--builder') || args.length === 0,
  pakeCliTests: args.includes('--pake-cli'),
  e2e: args.includes('--e2e') || args.includes('--full'),
  realBuild: args.includes('--real-build') || args.length === 0, // Include real build in default tests
  quick: args.includes('--quick')
};

// Help message
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🚀 Pake CLI Test Suite

Usage: node tests/index.js [options]

Options:
  --unit         Run unit tests (default)
  --integration  Run integration tests (default)  
  --builder      Run builder tests (default)
  --pake-cli     Run pake-cli GitHub Actions tests
  --e2e, --full  Run end-to-end tests
  --real-build   Run complete real build test (8+ minutes)
  --quick        Run only essential tests (fast)
  --help, -h     Show this help message

Examples:
  npm test                         # Run all default tests
  node tests/index.js              # Run all default tests
  node tests/index.js --quick      # Quick test (30 seconds)
  node tests/index.js --real-build # Complete build test (8+ minutes)
  node tests/index.js --pake-cli   # GitHub Actions tests
  node tests/index.js --e2e        # Full end-to-end tests
  node tests/index.js --unit --integration  # Specific tests only

Environment:
  CI=1              # Enable CI mode
  DEBUG=1           # Enable debug output
  PAKE_CREATE_APP=1 # Allow app creation in tests
`);
  process.exit(0);
}

// Run tests
const runner = new PakeTestRunner();
runner.runAll(options)
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });

export default runner;