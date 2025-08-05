import fs from "fs";
import path from "path";
import axios from "axios";
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

// Build parameters construction
const buildParameters = () => {
  const params = [
    "cli.js",
    process.env.URL,
    "--name",
    process.env.NAME,
    "--height",
    process.env.HEIGHT,
    "--width",
    process.env.WIDTH,
  ];

  if (process.env.HIDE_TITLE_BAR === "true") {
    params.push("--hide-title-bar");
  }

  if (process.env.FULLSCREEN === "true") {
    params.push("--fullscreen");
  }

  if (process.env.MULTI_ARCH === "true") {
    // We'll handle rustup separately since it's a different command
    params.push("--multi-arch");
  }

  if (process.env.TARGETS) {
    params.push("--targets", process.env.TARGETS);
  }

  if (process.platform === "win32" || process.platform === "linux") {
    params.push("--show-system-tray");
  }

  return params;
};

// Icon download handling
const downloadIcon = async (iconFile) => {
  try {
    const response = await axios.get(process.env.ICON, {
      responseType: "arraybuffer",
    });
    fs.writeFileSync(iconFile, response.data);
    return ["--icon", iconFile];
  } catch (error) {
    console.error("Error occurred during icon download:", error);
    throw error;
  }
};

// Get icon file name based on platform
const getIconFileName = () => {
  switch (process.platform) {
    case "linux":
      return "icon.png";
    case "darwin":
      return "icon.icns";
    case "win32":
      return "icon.ico";
    default:
      throw new Error("Unable to detect your OS system");
  }
};

// Main execution
const main = async () => {
  try {
    logConfiguration();

    const cliPath = path.join(process.cwd(), "node_modules/pake-cli");
    process.chdir(cliPath);

    let params = buildParameters();

    if (process.env.MULTI_ARCH === "true") {
      await execa("rustup", ["target", "add", "aarch64-apple-darwin"]);
    }

    if (process.env.ICON && process.env.ICON !== "") {
      const iconFile = getIconFileName();
      const iconParams = await downloadIcon(iconFile);
      params.push(...iconParams);
    } else {
      console.log(
        "Won't download the icon as ICON environment variable is not defined!",
      );
    }

    console.log("Pake parameters:", params.join(" "));
    console.log("Compiling....");

    // Execute the CLI command
    await execa("node", params, { stdio: "inherit" });

    // Create output directory if it doesn't exist
    if (!fs.existsSync("output")) {
      fs.mkdirSync("output");
    }

    // Move built files to output directory
    const files = fs.readdirSync(".");
    const namePattern = new RegExp(`^${process.env.NAME}\\..*$`);
    for (const file of files) {
      if (namePattern.test(file)) {
        await execa("mv", [file, path.join("output", file)]);
      }
    }

    console.log("Build Success");
    process.chdir("../..");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
};

main();
