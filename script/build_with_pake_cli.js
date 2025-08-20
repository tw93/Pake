import fs from "fs";
import path from "path";
import { execa } from "execa";
// We'll call the CLI directly for icon handling

// Configuration logging
const logConfiguration = () => {
  console.log("Welcome to use pake-cli to build app");
  console.log("Node.js info in your localhost:", process.version);
  console.log("\n=======================\n");
  console.log("Pake parameters:");
  console.log("url:", process.env.URL);
  console.log("name:", process.env.NAME);
  console.log("icon:", process.env.ICON);
  console.log("height:", process.env.HEIGHT);
  console.log("width:", process.env.WIDTH);
  console.log("fullscreen:", process.env.FULLSCREEN);
  console.log("hide-title-bar:", process.env.HIDE_TITLE_BAR);
  console.log("is multi arch? only for Mac:", process.env.MULTI_ARCH);
  console.log("targets type? only for Linux:", process.env.TARGETS);
  console.log("===========================\n");
};

// Main execution
const main = async () => {
  try {
    logConfiguration();

    const cliPath = path.join(process.cwd(), "node_modules/pake-cli");
    process.chdir(cliPath);

    // Build CLI parameters
    let params = [
      "dist/cli.js",
      process.env.URL,
      "--name",
      process.env.NAME,
      "--height",
      process.env.HEIGHT,
      "--width",
      process.env.WIDTH,
    ];

    if (
      process.env.HIDE_TITLE_BAR === "true" &&
      process.platform === "darwin"
    ) {
      params.push("--hide-title-bar");
    }

    if (process.env.FULLSCREEN === "true") {
      params.push("--fullscreen");
    }

    if (process.env.MULTI_ARCH === "true" && process.platform === "darwin") {
      params.push("--multi-arch");
    }

    if (process.env.TARGETS && process.platform === "linux") {
      params.push("--targets", process.env.TARGETS);
    }

    if (process.platform === "win32" || process.platform === "linux") {
      params.push("--show-system-tray");
    }

    // Add icon parameter if provided - CLI will handle download and conversion
    if (process.env.ICON && process.env.ICON !== "") {
      params.push("--icon", process.env.ICON);
    } else {
      console.log(
        "Won't use icon as ICON environment variable is not defined!",
      );
    }

    console.log("Pake parameters:", params.join(" "));
    console.log("Compiling....");

    // Execute the CLI command with extended timeout
    const timeout = 900000; // 15 minutes for all builds
    await execa("node", params, { stdio: "inherit", timeout });

    // Create output directory if it doesn't exist
    if (!fs.existsSync("output")) {
      fs.mkdirSync("output");
    }

    // Move built files to output directory more efficiently
    const buildPaths = [
      `src-tauri/target/release/bundle`,
      `src-tauri/target/universal-apple-darwin/release/bundle`,
    ];

    for (const buildPath of buildPaths) {
      if (fs.existsSync(buildPath)) {
        const bundleFiles = fs
          .readdirSync(buildPath, { recursive: true })
          .filter((file) => {
            const fullPath = path.join(buildPath, file);
            return (
              fs.statSync(fullPath).isFile() &&
              (file.endsWith(".dmg") ||
                file.endsWith(".exe") ||
                file.endsWith(".deb") ||
                file.endsWith(".rpm") ||
                file.endsWith(".AppImage"))
            );
          });

        for (const file of bundleFiles) {
          const srcPath = path.join(buildPath, file);
          const destPath = path.join("output", path.basename(file));
          // Use fs.copyFileSync for cross-platform compatibility
          fs.copyFileSync(srcPath, destPath);
        }
        break; // Found files, no need to check other paths
      }
    }

    // Fallback to original method if no bundle files found
    const files = fs.readdirSync(".");
    const namePattern = new RegExp(`^${process.env.NAME}\\..*$`);
    let foundFiles = false;
    for (const file of files) {
      if (namePattern.test(file)) {
        // Use fs for cross-platform file operations
        const destPath = path.join("output", file);
        fs.renameSync(file, destPath);
        foundFiles = true;
      }
    }

    if (!foundFiles) {
      console.log("Warning: No output files found matching pattern");
    }

    console.log("Build Success");
    process.chdir("../..");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
};

main();
