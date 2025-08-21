import fs from "fs";
import path from "path";
import { execa } from "execa";

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

    // Check if pake-cli directory exists
    if (!fs.existsSync(cliPath)) {
      console.error("Error: pake-cli not found at", cliPath);
      console.error(
        "Please make sure pake-cli is installed: npm install pake-cli",
      );
      process.exit(1);
    }

    process.chdir(cliPath);

    // Clean up any previous configuration to ensure fresh build
    const pakeDirPath = path.join("src-tauri", ".pake");

    // Remove .pake directory to force fresh config generation
    if (fs.existsSync(pakeDirPath)) {
      fs.rmSync(pakeDirPath, { recursive: true, force: true });
      console.log("Cleaned previous .pake directory for fresh build");
    }

    // Also clean any potential target directories that might contain cached configs
    const targetDirs = [
      "src-tauri/target",
      "src-tauri/target/debug",
      "src-tauri/target/release", 
      "src-tauri/target/universal-apple-darwin"
    ];
    
    targetDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        // Only remove .pake subdirectories, not the entire target directory
        const targetPakeDir = path.join(dir, ".pake");
        if (fs.existsSync(targetPakeDir)) {
          fs.rmSync(targetPakeDir, { recursive: true, force: true });
          console.log(`Cleaned .pake directory in ${dir}`);
        }
      }
    });

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
        "No icon provided, pake-cli will attempt to fetch favicon or use default",
      );
    }

    console.log("Pake parameters:", params.join(" "));
    console.log("Expected app name:", process.env.NAME);
    console.log("Compiling....");

    // Execute the CLI command
    await execa("node", params, { stdio: "inherit" });

    // Create output directory and move built files
    if (!fs.existsSync("output")) {
      fs.mkdirSync("output");
    }

    // pake-cli outputs files to current directory with various naming patterns
    const files = fs.readdirSync(".");
    const appName = process.env.NAME;
    const escapedAppName = appName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape regex special chars

    // Create comprehensive pattern for app files
    const appFilePattern = new RegExp(
      `^(${escapedAppName}|${escapedAppName.toLowerCase()})(_.*|\\..*)$`,
      "i",
    );
    let foundFiles = false;

    for (const file of files) {
      if (appFilePattern.test(file)) {
        const destPath = path.join("output", file);
        fs.renameSync(file, destPath);
        console.log(`Moved: ${file} -> output/${file}`);
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
