import path from 'path';
import axios from 'axios';
import fsExtra from 'fs-extra';
import chalk from 'chalk';
import { dir } from 'tmp-promise';
import { fileTypeFromBuffer } from 'file-type';
import icongen from 'icon-gen';
import sharp from 'sharp';

import logger from './logger';
import { getSpinner } from '@/utils/info';
import { npmDirectory } from '@/utils/dir';
import { IS_LINUX, IS_WIN } from '@/utils/platform';
import { PakeAppOptions } from '@/types';

type PlatformIconConfig = {
  format: string;
  sizes?: number[];
  size?: number;
};
const ICON_CONFIG = {
  minFileSize: 100,
  supportedFormats: ['png', 'ico', 'jpeg', 'jpg', 'webp', 'icns'] as const,
  whiteBackground: { r: 255, g: 255, b: 255 },
  transparentBackground: { r: 255, g: 255, b: 255, alpha: 0 },
  downloadTimeout: {
    ci: 5000,
    default: 15000,
  },
} as const;

const PLATFORM_CONFIG: Record<'win' | 'linux' | 'macos', PlatformIconConfig> = {
  win: { format: '.ico', sizes: [16, 32, 48, 64, 128, 256] },
  linux: { format: '.png', size: 512 },
  macos: { format: '.icns', sizes: [16, 32, 64, 128, 256, 512, 1024] },
};

const API_KEYS = {
  logoDev: ['pk_JLLMUKGZRpaG5YclhXaTkg', 'pk_Ph745P8mQSeYFfW2Wk039A'],
  brandfetch: ['1idqvJC0CeFSeyp3Yf7', '1idej-yhU_ThggIHFyG'],
};

/**
 * Generates platform-specific icon paths and handles copying for Windows
 */
function generateIconPath(appName: string, isDefault = false): string {
  const safeName = appName.toLowerCase().replace(/[^a-z0-9-_]/g, '_');
  const baseName = isDefault ? 'icon' : safeName;

  if (IS_WIN) {
    return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_256.ico`);
  }
  if (IS_LINUX) {
    return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_512.png`);
  }
  return path.join(npmDirectory, 'src-tauri', 'icons', `${baseName}.icns`);
}

async function copyWindowsIconIfNeeded(
  convertedPath: string,
  appName: string,
): Promise<string> {
  if (!IS_WIN || !convertedPath.endsWith('.ico')) {
    return convertedPath;
  }

  try {
    const finalIconPath = generateIconPath(appName);
    await fsExtra.ensureDir(path.dirname(finalIconPath));
    await fsExtra.copy(convertedPath, finalIconPath);
    return finalIconPath;
  } catch (error) {
    logger.warn(
      `Failed to copy Windows icon: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    return convertedPath;
  }
}

/**
 * Adds white background to transparent icons only
 */
async function preprocessIcon(inputPath: string): Promise<string> {
  try {
    const metadata = await sharp(inputPath).metadata();
    if (metadata.channels !== 4) return inputPath; // No transparency

    const { path: tempDir } = await dir();
    const outputPath = path.join(tempDir, 'icon-with-background.png');

    await sharp({
      create: {
        width: metadata.width || 512,
        height: metadata.height || 512,
        channels: 3,
        background: ICON_CONFIG.whiteBackground,
      },
    })
      .composite([{ input: inputPath }])
      .png()
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    logger.warn(`Failed to add background to icon: ${error.message}`);
    return inputPath;
  }
}

/**
 * Converts icon to platform-specific format
 */
async function convertIconFormat(
  inputPath: string,
  appName: string,
): Promise<string | null> {
  try {
    if (!(await fsExtra.pathExists(inputPath))) return null;

    const { path: outputDir } = await dir();
    const platformOutputDir = path.join(outputDir, 'converted-icons');
    await fsExtra.ensureDir(platformOutputDir);

    const processedInputPath = await preprocessIcon(inputPath);
    const iconName = appName.toLowerCase();

    // Generate platform-specific format
    if (IS_WIN) {
      // Support multiple sizes for better Windows compatibility
      await icongen(processedInputPath, platformOutputDir, {
        report: false,
        ico: {
          name: `${iconName}_256`,
          sizes: PLATFORM_CONFIG.win.sizes,
        },
      });
      return path.join(
        platformOutputDir,
        `${iconName}_256${PLATFORM_CONFIG.win.format}`,
      );
    }

    if (IS_LINUX) {
      const outputPath = path.join(
        platformOutputDir,
        `${iconName}_${PLATFORM_CONFIG.linux.size}${PLATFORM_CONFIG.linux.format}`,
      );

      // Ensure we convert to proper PNG format with correct size
      await sharp(processedInputPath)
        .resize(PLATFORM_CONFIG.linux.size, PLATFORM_CONFIG.linux.size, {
          fit: 'contain',
          background: ICON_CONFIG.transparentBackground,
        })
        .png()
        .toFile(outputPath);

      return outputPath;
    }

    // macOS
    await icongen(processedInputPath, platformOutputDir, {
      report: false,
      icns: { name: iconName, sizes: PLATFORM_CONFIG.macos.sizes },
    });
    const outputPath = path.join(
      platformOutputDir,
      `${iconName}${PLATFORM_CONFIG.macos.format}`,
    );
    return (await fsExtra.pathExists(outputPath)) ? outputPath : null;
  } catch (error) {
    logger.warn(`Icon format conversion failed: ${error.message}`);
    return null;
  }
}

/**
 * Processes downloaded or local icon for platform-specific format
 */
async function processIcon(
  iconPath: string,
  appName: string,
): Promise<string | null> {
  if (!iconPath || !appName) return iconPath;

  // Check if already in correct platform format
  const ext = path.extname(iconPath).toLowerCase();
  const isCorrectFormat =
    (IS_WIN && ext === '.ico') ||
    (IS_LINUX && ext === '.png') ||
    (!IS_WIN && !IS_LINUX && ext === '.icns');

  if (isCorrectFormat) {
    return await copyWindowsIconIfNeeded(iconPath, appName);
  }

  // Convert to platform format
  const convertedPath = await convertIconFormat(iconPath, appName);
  if (convertedPath) {
    return await copyWindowsIconIfNeeded(convertedPath, appName);
  }

  return iconPath;
}

/**
 * Gets default icon with platform-specific fallback logic
 */
async function getDefaultIcon(): Promise<string> {
  logger.info('✼ No icon provided, using default icon.');

  if (IS_WIN) {
    const defaultIcoPath = generateIconPath('icon', true);
    const defaultPngPath = path.join(
      npmDirectory,
      'src-tauri/png/icon_512.png',
    );

    // Try default ico first
    if (await fsExtra.pathExists(defaultIcoPath)) {
      return defaultIcoPath;
    }

    // Convert from png if ico doesn't exist
    if (await fsExtra.pathExists(defaultPngPath)) {
      logger.info('✼ Default ico not found, converting from png...');
      try {
        const convertedPath = await convertIconFormat(defaultPngPath, 'icon');
        if (convertedPath && (await fsExtra.pathExists(convertedPath))) {
          return await copyWindowsIconIfNeeded(convertedPath, 'icon');
        }
      } catch (error) {
        logger.warn(
          `Failed to convert default png to ico: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Fallback to png or empty
    if (await fsExtra.pathExists(defaultPngPath)) {
      logger.warn('✼ Using png as fallback for Windows (may cause issues).');
      return defaultPngPath;
    }

    logger.warn('✼ No default icon found, will use pake default.');
    return '';
  }

  // Linux and macOS defaults
  const iconPath = IS_LINUX
    ? 'src-tauri/png/icon_512.png'
    : 'src-tauri/icons/icon.icns';
  return path.join(npmDirectory, iconPath);
}

/**
 * Main icon handling function with simplified logic flow
 */
export async function handleIcon(
  options: PakeAppOptions,
  url?: string,
): Promise<string> {
  // Handle custom icon (local file or remote URL)
  if (options.icon) {
    if (options.icon.startsWith('http')) {
      const downloadedPath = await downloadIcon(options.icon);
      if (downloadedPath) {
        const result = await processIcon(downloadedPath, options.name || '');
        if (result) return result;
      }
      return '';
    }
    // Local file path
    const resolvedPath = path.resolve(options.icon);
    const result = await processIcon(resolvedPath, options.name || '');
    return result || resolvedPath;
  }

  // Try favicon from website
  if (url && options.name) {
    const faviconPath = await tryGetFavicon(url, options.name);
    if (faviconPath) return faviconPath;
  }

  // Use default icon
  return await getDefaultIcon();
}

/**
 * Generates icon service URLs for a domain
 */
function generateIconServiceUrls(domain: string): string[] {
  const logoDevUrls = API_KEYS.logoDev
    .sort(() => Math.random() - 0.5)
    .map(
      (token) =>
        `https://img.logo.dev/${domain}?token=${token}&format=png&size=256`,
    );

  const brandfetchUrls = API_KEYS.brandfetch
    .sort(() => Math.random() - 0.5)
    .map((key) => `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${key}`);

  return [
    ...logoDevUrls,
    ...brandfetchUrls,
    `https://logo.clearbit.com/${domain}?size=256`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    `https://favicon.is/${domain}`,
    `https://${domain}/favicon.ico`,
    `https://www.${domain}/favicon.ico`,
  ];
}

/**
 * Attempts to fetch favicon from website
 */
async function tryGetFavicon(
  url: string,
  appName: string,
): Promise<string | null> {
  try {
    const domain = new URL(url).hostname;
    const spinner = getSpinner(`Fetching icon from ${domain}...`);

    const serviceUrls = generateIconServiceUrls(domain);

    const isCI =
      process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const downloadTimeout = isCI
      ? ICON_CONFIG.downloadTimeout.ci
      : ICON_CONFIG.downloadTimeout.default;

    for (const serviceUrl of serviceUrls) {
      try {
        const faviconPath = await downloadIcon(
          serviceUrl,
          false,
          downloadTimeout,
        );
        if (!faviconPath) continue;

        const convertedPath = await convertIconFormat(faviconPath, appName);
        if (convertedPath) {
          const finalPath = await copyWindowsIconIfNeeded(
            convertedPath,
            appName,
          );
          spinner.succeed(
            chalk.green('Icon fetched and converted successfully!'),
          );
          return finalPath;
        }
      } catch (error) {
        logger.debug(`Icon service ${serviceUrl} failed: ${error.message}`);

        // Platform-specific error handling
        if ((IS_LINUX || IS_WIN) && error.code === 'ENOTFOUND') {
          logger.debug(
            `DNS resolution failed for ${serviceUrl}, trying next service...`,
          );
        }

        // Windows-specific icon conversion errors
        if (IS_WIN && error.message.includes('icongen')) {
          logger.debug(
            `Windows icon conversion failed for ${serviceUrl}, trying next service...`,
          );
        }

        continue;
      }
    }

    spinner.warn(`No favicon found for ${domain}. Using default.`);
    return null;
  } catch (error) {
    logger.warn(`Failed to fetch favicon: ${error.message}`);
    return null;
  }
}

/**
 * Downloads icon from URL
 */
export async function downloadIcon(
  iconUrl: string,
  showSpinner = true,
  customTimeout?: number,
): Promise<string | null> {
  try {
    const response = await axios.get(iconUrl, {
      responseType: 'arraybuffer',
      timeout: customTimeout || 10000,
    });

    const iconData = response.data;
    if (!iconData || iconData.byteLength < ICON_CONFIG.minFileSize) return null;

    const fileDetails = await fileTypeFromBuffer(iconData);
    if (
      !fileDetails ||
      !ICON_CONFIG.supportedFormats.includes(fileDetails.ext as any)
    ) {
      return null;
    }

    return await saveIconFile(iconData, fileDetails.ext);
  } catch (error) {
    if (showSpinner && !(error.response?.status === 404)) {
      throw error;
    }
    return null;
  }
}

/**
 * Saves icon file to temporary location
 */
async function saveIconFile(
  iconData: ArrayBuffer,
  extension: string,
): Promise<string> {
  const buffer = Buffer.from(iconData);
  const { path: tempPath } = await dir();

  // Always save with the original extension first
  const originalIconPath = path.join(tempPath, `icon.${extension}`);
  await fsExtra.outputFile(originalIconPath, buffer);

  return originalIconPath;
}
