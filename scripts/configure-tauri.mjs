import pakeJson from "../src-tauri/pake.json" with { type: "json" };
import tauriJson from "../src-tauri/tauri.conf.json" with { type: "json" };
import windowsJson from "../src-tauri/tauri.windows.conf.json" with { type: "json" };
import macosJson from "../src-tauri/tauri.macos.conf.json" with { type: "json" };
import linuxJson from "../src-tauri/tauri.linux.conf.json" with { type: "json" };

import { writeFileSync, existsSync, copyFileSync } from "fs";
import os from "os";
import sharp from "sharp";

/**
 * Configuration script for Tauri app generation
 * Sets up platform-specific configurations, icons, and desktop entries
 */

// Environment validation
const requiredEnvVars = ["URL", "NAME", "TITLE", "NAME_ZH"];

function validateEnvironment() {
  const missing = requiredEnvVars.filter((key) => !(key in process.env));

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  console.log("Environment variables:");
  requiredEnvVars.forEach((key) => {
    console.log(`  ${key}: ${process.env[key]}`);
  });
}

// Configuration constants
const CONFIG = {
  get identifier() {
    return `com.pake.${process.env.NAME}`;
  },
  get productName() {
    return `com-pake-${process.env.NAME}`;
  },

  paths: {
    pakeConfig: "src-tauri/pake.json",
    tauriConfig: "src-tauri/tauri.conf.json",
  },

  platforms: {
    linux: {
      configFile: "src-tauri/tauri.linux.conf.json",
      iconPath: `src-tauri/png/${process.env.NAME}_512.png`,
      defaultIcon: "src-tauri/png/icon_512.png",
      icons: [`png/${process.env.NAME}_512.png`],
      get desktopEntry() {
        return `[Desktop Entry]
Encoding=UTF-8
Categories=Office
Exec=${CONFIG.productName}
Icon=${CONFIG.productName}
Name=${CONFIG.productName}
Name[zh_CN]=${process.env.NAME_ZH}
StartupNotify=true
Terminal=false
Type=Application
`;
      },
      get desktopEntryPath() {
        return `src-tauri/assets/${CONFIG.productName}.desktop`;
      },
      get desktopConfig() {
        return {
          key: `/usr/share/applications/${CONFIG.productName}.desktop`,
          value: `assets/${CONFIG.productName}.desktop`,
        };
      },
    },

    darwin: {
      configFile: "src-tauri/tauri.macos.conf.json",
      iconPath: `src-tauri/icons/${process.env.NAME}.icns`,
      defaultIcon: "src-tauri/icons/icon.icns",
      icons: [`icons/${process.env.NAME}.icns`],
    },

    win32: {
      configFile: "src-tauri/tauri.windows.conf.json",
      iconPath: `src-tauri/png/${process.env.NAME}_32.ico`,
      hdIconPath: `src-tauri/png/${process.env.NAME}_256.ico`,
      defaultIcon: "src-tauri/png/icon_32.ico",
      hdDefaultIcon: "src-tauri/png/icon_256.ico",
      icons: [
        `png/${process.env.NAME}_256.ico`,
        `png/${process.env.NAME}_32.ico`,
      ],
      resources: [`png/${process.env.NAME}_32.ico`],
    },
  },
};

// Core configuration functions
function updateBaseConfigs() {
  // Update pake.json
  pakeJson.windows[0].url = process.env.URL;

  // Update system tray icon path in pake.json
  if (pakeJson.system_tray_path) {
    pakeJson.system_tray_path = `icons/${process.env.NAME}.png`;
    // Note: System tray icons should be provided in default_app_list.json
    // Don't auto-generate them here to avoid wrong icon content
  }

  // Update tauri.conf.json
  tauriJson.productName = process.env.TITLE;
  tauriJson.identifier = CONFIG.identifier;

  // Update tray icon path in tauri.conf.json
  if (tauriJson.app && tauriJson.app.trayIcon) {
    tauriJson.app.trayIcon.iconPath = `png/${process.env.NAME}_512.png`;
    // Note: Tray icons should be provided in default_app_list.json
    // Don't auto-generate them here to avoid wrong icon content
  }
}

async function ensureRgbaPng(iconPath) {
  try {
    const buffer = await sharp(iconPath)
      .ensureAlpha()
      .png({ force: true })
      .toBuffer();
    writeFileSync(iconPath, buffer);
  } catch (error) {
    console.warn(`Failed to normalize ${iconPath} to RGBA: ${error.message}`);
  }
}

async function ensureIconExists(
  iconPath,
  defaultPath,
  description = "icon",
  ensureRgba = false,
) {
  if (!existsSync(iconPath)) {
    if (process.env.PAKE_CREATE_APP === "1") {
      console.warn(
        `${description} for ${process.env.NAME} not found at ${iconPath}`,
      );
      return;
    }
    console.warn(
      `${description} for ${process.env.NAME} not found, using default`,
    );
    copyFileSync(defaultPath, iconPath);
  }

  if (ensureRgba && existsSync(iconPath)) {
    await ensureRgbaPng(iconPath);
  }
}

function updatePlatformConfig(platformConfig, platformVars) {
  // Ensure bundle object exists
  if (!platformConfig.bundle) {
    platformConfig.bundle = {};
  }

  platformConfig.bundle.icon = platformVars.icons;
  platformConfig.identifier = CONFIG.identifier;
  platformConfig.productName = process.env.TITLE;
}

// Platform-specific handlers
const platformHandlers = {
  linux: async (config) => {
    await ensureIconExists(
      config.iconPath,
      config.defaultIcon,
      "Linux icon",
      true,
    );

    // Update desktop entry
    linuxJson.bundle.linux.deb.files = {
      [config.desktopConfig.key]: config.desktopConfig.value,
    };
    writeFileSync(config.desktopEntryPath, config.desktopEntry);

    updatePlatformConfig(linuxJson, config);
  },

  darwin: async (config) => {
    await ensureIconExists(config.iconPath, config.defaultIcon, "macOS icon");
    updatePlatformConfig(macosJson, config);
  },

  win32: async (config) => {
    await ensureIconExists(config.iconPath, config.defaultIcon, "Windows icon");
    await ensureIconExists(
      config.hdIconPath,
      config.hdDefaultIcon,
      "Windows HD icon",
    );

    // Update both bundle.icon and bundle.resources for Windows
    windowsJson.bundle.resources = config.resources;
    updatePlatformConfig(windowsJson, config);
  },
};

function saveConfigurations() {
  const configs = [
    { path: CONFIG.paths.pakeConfig, data: pakeJson },
    { path: CONFIG.paths.tauriConfig, data: tauriJson },
    { path: CONFIG.platforms.linux.configFile, data: linuxJson },
    { path: CONFIG.platforms.darwin.configFile, data: macosJson },
    { path: CONFIG.platforms.win32.configFile, data: windowsJson },
  ];

  configs.forEach(({ path, data }) => {
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  });
}

// Main execution
async function main() {
  try {
    validateEnvironment();
    updateBaseConfigs();

    const platform = os.platform();
    const platformConfig = CONFIG.platforms[platform];

    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const handler = platformHandlers[platform];
    if (handler) {
      await handler(platformConfig);
    }

    saveConfigurations();
    console.log(`✅ Tauri configuration complete for ${platform}`);
  } catch (error) {
    console.error("❌ Configuration failed:", error.message);
    process.exit(1);
  }
}

main();
