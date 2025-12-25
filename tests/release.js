#!/usr/bin/env node

/**
 * Release Build Test
 *
 * Tests the actual release workflow by building 2 sample apps.
 * Validates the complete packaging process.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { PROJECT_ROOT } from "./config.js";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";

// Fixed test apps for consistent testing
const TEST_APPS = ["weread", "twitter"];

class ReleaseBuildTest {
  constructor() {
    this.startTime = Date.now();
  }

  log(level, message) {
    const colors = { INFO: GREEN, WARN: YELLOW, ERROR: RED, DEBUG: BLUE };
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[level] || NC}[${timestamp}] ${message}${NC}`);
  }

  async getAppConfig(appName) {
    const configPath = path.join(PROJECT_ROOT, "default_app_list.json");
    const apps = JSON.parse(fs.readFileSync(configPath, "utf8"));

    let config = apps.find((app) => app.name === appName);

    // All test apps should be in default_app_list.json
    if (!config) {
      throw new Error(`App "${appName}" not found in default_app_list.json`);
    }

    return config;
  }

  async buildApp(appName) {
    this.log("INFO", `🔨 Building ${appName}...`);

    const config = await this.getAppConfig(appName);
    if (!config) {
      throw new Error(`App config not found: ${appName}`);
    }

    // Set environment variables
    process.env.NAME = config.name;
    process.env.TITLE = config.title;
    process.env.NAME_ZH = config.name_zh;
    process.env.URL = config.url;

    try {
      // Build config
      this.log("INFO", `\n📦 Building ${appName}...\n`);

      // Build the app using CLI directly
      this.log("DEBUG", "Building app package...");
      const commonArgs = "--iterative-build --debug";
      const cmd = `node dist/cli.js ${config.url} --name ${config.name} --icon ${config.icon} ${commonArgs}`;

      try {
        execSync(cmd, {
          stdio: "pipe",
          timeout: 480000, // 8 minutes
          env: { ...process.env, PAKE_CREATE_APP: "1" },
        });

        // Check files immediately after build
        const outputFiles = this.findOutputFiles(config.name);
        if (outputFiles.length === 0) {
          throw new Error("No output files generated");
        }
      } catch (buildError) {
        throw new Error(`Build failed: ${buildError.message}`);
      }

      // Always return true - release test just needs to verify the process works
      this.log("INFO", `✅ Successfully built ${config.title}`);
      return true;
    } catch (error) {
      this.log("ERROR", `❌ Failed to build ${config.title}: ${error.message}`);
      return false;
    }
  }

  findOutputFiles(appName) {
    const files = [];

    // Check for direct output files (created by PAKE_CREATE_APP=1)
    const directPatterns = [
      `${appName}.dmg`,
      `${appName}.app`,
      `${appName}.msi`,
      `${appName}.deb`,
      `${appName}.AppImage`,
    ];

    // Use Node.js fs instead of Unix find command for cross-platform compatibility
    for (const pattern of directPatterns) {
      try {
        const rootPath = path.join(PROJECT_ROOT);
        if (fs.existsSync(rootPath)) {
          const items = fs.readdirSync(rootPath);
          const matching = items.filter((item) => item === pattern);
          matching.forEach((item) => {
            files.push(path.join(rootPath, item));
          });
        }
      } catch (error) {
        // Ignore errors
      }
    }

    // Also check bundle directories for app and dmg files
    const bundleLocations = [
      `src-tauri/target/release/bundle/macos/${appName}.app`,
      `src-tauri/target/release/bundle/dmg/${appName}.dmg`,
      `src-tauri/target/universal-apple-darwin/release/bundle/macos/${appName}.app`,
      `src-tauri/target/universal-apple-darwin/release/bundle/dmg/${appName}.dmg`,
      `src-tauri/target/release/bundle/deb/${appName}_*.deb`,
      `src-tauri/target/release/bundle/msi/${appName}_*.msi`,
      `src-tauri/target/release/bundle/appimage/${appName}_*.AppImage`,
    ];

    for (const location of bundleLocations) {
      try {
        if (location.includes("*")) {
          // Handle wildcard patterns using Node.js
          const dir = path.dirname(location);
          const pattern = path.basename(location);
          const fullDir = path.join(PROJECT_ROOT, dir);

          if (fs.existsSync(fullDir)) {
            const items = fs.readdirSync(fullDir);
            // Convert glob pattern to regex
            const regex = new RegExp(
              "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
            );
            const matching = items.filter((item) => regex.test(item));
            matching.forEach((item) => {
              const fullPath = path.join(fullDir, item);
              if (fs.statSync(fullPath).isFile() || item.endsWith(".app")) {
                files.push(fullPath);
              }
            });
          }
        } else {
          // Direct path check
          const fullPath = path.join(PROJECT_ROOT, location);
          if (fs.existsSync(fullPath)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return files.filter((f) => f && f.length > 0);
  }

  async run(options = {}) {
    console.log(`${BLUE}🚀 Release Build Test${NC}`);
    console.log(`${BLUE}===================${NC}`);

    // Build CLI first (unless skipped)
    if (!options.skipCliBuild) {
      this.log("INFO", "🔨 Building CLI...");
      try {
        execSync(`pnpm run cli:build`, { stdio: "pipe" });
      } catch (e) {
        this.log("ERROR", "Failed to build CLI");
        return false;
      }
    }

    console.log(`Testing apps: ${TEST_APPS.join(", ")}`);
    console.log("");

    let successCount = 0;
    const results = [];

    for (const appName of TEST_APPS) {
      try {
        const success = await this.buildApp(appName);

        if (success) {
          successCount++;
          // Optional: Show generated files if found
          const outputFiles = this.findOutputFiles(appName);
          if (outputFiles.length > 0) {
            this.log("INFO", `📦 Generated files for ${appName}:`);
            outputFiles.forEach((file) => {
              try {
                const stats = fs.statSync(file);
                const size = (stats.size / 1024 / 1024).toFixed(1);
                this.log("INFO", `   - ${file} (${size}MB)`);
              } catch (error) {
                this.log("INFO", `   - ${file}`);
              }
            });
          }
        }

        results.push({
          app: appName,
          success,
          outputFiles: this.findOutputFiles(appName),
        });
      } catch (error) {
        this.log("ERROR", `Failed to build ${appName}: ${error.message}`);
        results.push({ app: appName, success: false, error: error.message });
      }

      console.log(""); // Add spacing between apps
    }

    // Summary
    const duration = Math.round((Date.now() - this.startTime) / 1000);

    console.log(`${BLUE}📊 Test Summary${NC}`);
    console.log(`==================`);
    console.log(`✅ Successful builds: ${successCount}/${TEST_APPS.length}`);
    console.log(`⏱️  Total time: ${duration}s`);

    if (successCount === TEST_APPS.length) {
      this.log("INFO", "🎉 All test builds completed successfully!");
      this.log("INFO", "Release workflow logic is working correctly.");
    } else {
      this.log(
        "ERROR",
        `⚠️  ${TEST_APPS.length - successCount} builds failed.`,
      );
    }

    return successCount === TEST_APPS.length;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ReleaseBuildTest();
  const success = await tester.run();
  process.exit(success ? 0 : 1);
}

export default ReleaseBuildTest;
