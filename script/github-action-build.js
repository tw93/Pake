import fs from "fs";
import path from "path";
import { execa } from "execa";

/**
 * GitHub Actions build script for Pake CLI
 * Handles environment setup, parameter building, and output management
 */

// Environment variables expected from GitHub Actions
const ENV_VARS = {
  required: ["URL", "NAME", "HEIGHT", "WIDTH"],
  optional: ["ICON", "FULLSCREEN", "HIDE_TITLE_BAR", "MULTI_ARCH", "TARGETS"],
};

// Platform-specific configurations
const PLATFORM_CONFIG = {
  darwin: {
    supportsHideTitleBar: true,
    supportsMultiArch: true,
    needsSystemTray: false,
  },
  linux: {
    supportsTargets: true,
    needsSystemTray: true,
  },
  win32: {
    needsSystemTray: true,
  },
};

class PakeBuildManager {
  constructor() {
    this.platform = process.platform;
    this.config = PLATFORM_CONFIG[this.platform] || {};
  }

  logConfiguration() {
    console.log("🚀 Pake CLI Build Started");
    console.log(`📋 Node.js version: ${process.version}`);
    console.log(`🖥️  Platform: ${this.platform}`);
    console.log("\n" + "=".repeat(50));
    console.log("📝 Build Parameters:");

    ENV_VARS.required.forEach((key) => {
      console.log(`  ${key}: ${process.env[key]}`);
    });

    ENV_VARS.optional.forEach((key) => {
      if (process.env[key]) {
        console.log(`  ${key}: ${process.env[key]}`);
      }
    });
    console.log("=".repeat(50) + "\n");
  }

  validateEnvironment() {
    const missing = ENV_VARS.required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`,
      );
    }
  }

  setupWorkspace() {
    const cliPath = path.join(process.cwd(), "node_modules/pake-cli");

    if (!fs.existsSync(cliPath)) {
      throw new Error(
        `pake-cli not found at ${cliPath}. Run: npm install pake-cli`,
      );
    }

    process.chdir(cliPath);
    this.cleanPreviousBuilds();

    return cliPath;
  }

  cleanPreviousBuilds() {
    const cleanupPaths = [
      "src-tauri/.pake",
      "src-tauri/target/.pake",
      "src-tauri/target/debug/.pake",
      "src-tauri/target/release/.pake",
      "src-tauri/target/universal-apple-darwin/.pake",
    ];

    cleanupPaths.forEach((dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`🧹 Cleaned: ${dirPath}`);
      }
    });
  }

  buildCliParameters() {
    const params = [
      "dist/cli.js",
      process.env.URL,
      "--name",
      process.env.NAME,
      "--height",
      process.env.HEIGHT,
      "--width",
      process.env.WIDTH,
    ];

    // Platform-specific parameters
    if (
      this.config.supportsHideTitleBar &&
      process.env.HIDE_TITLE_BAR === "true"
    ) {
      params.push("--hide-title-bar");
    }

    if (process.env.FULLSCREEN === "true") {
      params.push("--fullscreen");
    }

    if (this.config.supportsMultiArch && process.env.MULTI_ARCH === "true") {
      params.push("--multi-arch");
    }

    if (this.config.supportsTargets && process.env.TARGETS) {
      params.push("--targets", process.env.TARGETS);
    }

    if (this.config.needsSystemTray) {
      params.push("--show-system-tray");
    }

    // Icon handling
    if (process.env.ICON?.trim()) {
      params.push("--icon", process.env.ICON);
    } else {
      console.log(
        "ℹ️  No icon provided, will attempt to fetch favicon or use default",
      );
    }

    return params;
  }

  async executeBuild(params) {
    console.log(`🔧 Command: node ${params.join(" ")}`);
    console.log(`📱 Building app: ${process.env.NAME}`);
    console.log("⏳ Compiling...\n");

    await execa("node", params, { stdio: "inherit" });
  }

  organizeOutput() {
    const outputDir = "output";

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const appName = process.env.NAME;
    const filePattern = new RegExp(
      `^(${this.escapeRegex(appName)}|${this.escapeRegex(appName.toLowerCase())})(_.*|\\..*)$`,
      "i",
    );

    const files = fs.readdirSync(".");
    let movedFiles = 0;

    files.forEach((file) => {
      if (filePattern.test(file)) {
        const destPath = path.join(outputDir, file);
        fs.renameSync(file, destPath);
        console.log(`📦 Packaged: ${file}`);
        movedFiles++;
      }
    });

    if (movedFiles === 0) {
      console.warn(
        "⚠️  Warning: No output files found matching expected pattern",
      );
    }

    return movedFiles;
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async run() {
    try {
      this.logConfiguration();
      this.validateEnvironment();

      this.setupWorkspace();
      const params = this.buildCliParameters();

      await this.executeBuild(params);

      const fileCount = this.organizeOutput();

      console.log(`\n✅ Build completed successfully!`);
      console.log(`📦 Generated ${fileCount} output file(s)`);

      // Return to original directory
      process.chdir("../..");
    } catch (error) {
      console.error("\n❌ Build failed:", error.message);

      if (error.stderr) {
        console.error("Error details:", error.stderr);
      }

      process.exit(1);
    }
  }
}

// Execute build
const buildManager = new PakeBuildManager();
buildManager.run();
