import path from 'path';
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
import {
  generateDashboardIconSlugs,
  getIconSourcePriority,
  type IconSource,
} from '@/utils/icon-source';
import { generateLinuxPackageName, getSafeAppName } from '@/utils/name';
import { PakeAppOptions } from '@/types';
import { writeIcoWithPreferredSize, buildIcoFromPngBuffers } from '@/utils/ico';

type PlatformIconConfig = {
  format: string;
  sizes?: number[];
  size?: number;
};
const ICON_CONFIG = {
  minFileSize: 100,
  supportedFormats: [
    'png',
    'ico',
    'jpeg',
    'jpg',
    'webp',
    'icns',
    'svg',
  ] as const,
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

type SupportedIconFormat = (typeof ICON_CONFIG.supportedFormats)[number];

/**
 * Generates platform-specific icon paths and handles copying for Windows
 */
function generateIconPath(appName: string, isDefault = false): string {
  const safeName = isDefault ? 'icon' : getIconBaseName(appName);
  const baseName = safeName;

  if (IS_WIN) {
    return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_256.ico`);
  }
  if (IS_LINUX) {
    return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_512.png`);
  }
  return path.join(npmDirectory, 'src-tauri', 'icons', `${baseName}.icns`);
}

function getIconBaseName(appName: string): string {
  const baseName = IS_LINUX
    ? generateLinuxPackageName(appName)
    : getSafeAppName(appName);
  return baseName || 'pake-app';
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
    // Reorder ICO to prioritize 256px icons for better Windows display
    const reordered = await writeIcoWithPreferredSize(
      convertedPath,
      finalIconPath,
      256,
    );
    if (!reordered) {
      await fsExtra.copy(convertedPath, finalIconPath);
    }
    return finalIconPath;
  } catch (error) {
    logger.warn(
      `Failed to copy Windows icon: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    return convertedPath;
  }
}

/**
 * Normalizes icon inputs to PNG while preserving alpha.
 */
async function preprocessIcon(inputPath: string): Promise<string> {
  try {
    const extension = path.extname(inputPath).toLowerCase();
    const shouldNormalize = ['.png', '.jpeg', '.jpg', '.webp', '.svg'].includes(
      extension,
    );
    if (!shouldNormalize) {
      return inputPath;
    }

    const { path: tempDir } = await dir();
    const outputPath = path.join(tempDir, 'icon-normalized.png');

    await sharp(inputPath).ensureAlpha().png().toFile(outputPath);

    return outputPath;
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`Failed to normalize icon: ${error.message}`);
    }
    return inputPath;
  }
}

/**
 * Applies macOS squircle mask to icon
 */
async function applyMacOSMask(inputPath: string): Promise<string> {
  try {
    const { path: tempDir } = await dir();
    const outputPath = path.join(tempDir, 'icon-macos-rounded.png');

    // 1. Create a 1024x1024 rounded rect mask
    // rx="224" is closer to the smooth Apple squircle look for 1024px
    const mask = Buffer.from(
      '<svg width="1024" height="1024"><rect x="0" y="0" width="1024" height="1024" rx="224" ry="224" fill="white"/></svg>',
    );

    // 2. Load input, resize to 1024, apply mask
    const maskedBuffer = await sharp(inputPath)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .composite([
        {
          input: mask,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();

    // 3. Resize to 840x840 (~18% padding) to solve "too big" visual issue
    // Native MacOS icons often leave some breathing room
    await sharp(maskedBuffer)
      .resize(840, 840, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: 92,
        bottom: 92,
        left: 92,
        right: 92,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`Failed to apply macOS mask: ${error.message}`);
    }
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
    const iconName = getIconBaseName(appName);

    // Generate platform-specific format
    if (IS_WIN) {
      const icoPath = path.join(
        platformOutputDir,
        `${iconName}_256${PLATFORM_CONFIG.win.format}`,
      );
      const frames = await Promise.all(
        (PLATFORM_CONFIG.win.sizes as number[]).map(async (size) => {
          const png = await sharp(processedInputPath)
            .resize(size, size, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .ensureAlpha()
            .png()
            .toBuffer();
          return { size, png };
        }),
      );
      const icoBuffer = buildIcoFromPngBuffers(frames);
      await fsExtra.outputFile(icoPath, icoBuffer);
      return icoPath;
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
        .ensureAlpha()
        .png()
        .toFile(outputPath);

      return outputPath;
    }

    // macOS
    const macIconPath = await applyMacOSMask(processedInputPath);
    await icongen(macIconPath, platformOutputDir, {
      report: false,
      icns: { name: iconName, sizes: PLATFORM_CONFIG.macos.sizes },
    });
    const outputPath = path.join(
      platformOutputDir,
      `${iconName}${PLATFORM_CONFIG.macos.format}`,
    );
    return (await fsExtra.pathExists(outputPath)) ? outputPath : null;
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`Icon format conversion failed: ${error.message}`);
    }
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

  // Check for existing local icon before downloading
  if (options.name) {
    const localIconPath = generateIconPath(options.name);
    if (await fsExtra.pathExists(localIconPath)) {
      logger.info(`✼ Using existing local icon: ${localIconPath}`);
      return localIconPath;
    }
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
 * Generates dashboard-icons URLs for an app name.
 * Uses walkxcode/dashboard-icons as a final fallback for selfhosted apps.
 * Keeps matching conservative to avoid overriding valid site-specific icons.
 */
function generateDashboardIconUrls(appName: string): string[] {
  const baseUrl = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png';
  return generateDashboardIconSlugs(appName).map(
    (slug) => `${baseUrl}/${slug}.png`,
  );
}

function isSupportedIconFormat(
  extension: string,
): extension is SupportedIconFormat {
  return ICON_CONFIG.supportedFormats.includes(
    extension as SupportedIconFormat,
  );
}

function looksLikeSvg(arrayBuffer: ArrayBuffer): boolean {
  const sample = Buffer.from(arrayBuffer)
    .toString('utf-8', 0, Math.min(arrayBuffer.byteLength, 512))
    .trimStart()
    .toLowerCase();

  return (
    sample.startsWith('<svg') ||
    (sample.startsWith('<?xml') && sample.includes('<svg'))
  );
}

function getUrlExtension(iconUrl: string): string {
  try {
    return path.extname(new URL(iconUrl).pathname).slice(1).toLowerCase();
  } catch {
    return path.extname(iconUrl).slice(1).toLowerCase();
  }
}

async function detectDownloadedIconExtension(
  response: Response,
  arrayBuffer: ArrayBuffer,
  iconUrl: string,
): Promise<SupportedIconFormat | null> {
  const fileDetails = await fileTypeFromBuffer(arrayBuffer);
  if (fileDetails && isSupportedIconFormat(fileDetails.ext)) {
    return fileDetails.ext;
  }

  const contentType = response.headers
    .get('content-type')
    ?.split(';')[0]
    .trim();
  if (contentType === 'image/svg+xml' && looksLikeSvg(arrayBuffer)) {
    return 'svg';
  }

  if (getUrlExtension(iconUrl) === 'svg' && looksLikeSvg(arrayBuffer)) {
    return 'svg';
  }

  return null;
}

async function resolveIconFromUrl(
  iconUrl: string,
  appName: string,
  downloadTimeout: number,
): Promise<string | null> {
  const iconPath = await downloadIcon(iconUrl, false, downloadTimeout);
  if (!iconPath) {
    return null;
  }

  const convertedPath = await convertIconFormat(iconPath, appName);
  if (!convertedPath) {
    return null;
  }

  return await copyWindowsIconIfNeeded(convertedPath, appName);
}

async function tryResolveIconSource(
  source: IconSource,
  domain: string,
  appName: string,
  downloadTimeout: number,
): Promise<string | null> {
  const iconUrls =
    source === 'dashboard'
      ? generateDashboardIconUrls(appName)
      : generateIconServiceUrls(domain);

  for (const iconUrl of iconUrls) {
    try {
      const resolvedPath = await resolveIconFromUrl(
        iconUrl,
        appName,
        downloadTimeout,
      );
      if (resolvedPath) {
        return resolvedPath;
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        const label =
          source === 'dashboard' ? 'Dashboard icon' : 'Icon service';
        logger.debug(`${label} ${iconUrl} failed: ${error.message}`);
      }
    }
  }

  return null;
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

    const isCI =
      process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const downloadTimeout = isCI
      ? ICON_CONFIG.downloadTimeout.ci
      : ICON_CONFIG.downloadTimeout.default;

    const sourcePriority = getIconSourcePriority(url, appName);
    for (const source of sourcePriority) {
      const resolvedIconPath = await tryResolveIconSource(
        source,
        domain,
        appName,
        downloadTimeout,
      );
      if (!resolvedIconPath) {
        continue;
      }

      spinner.succeed(
        chalk.green(
          source === 'dashboard'
            ? `Icon found via dashboard-icons for "${appName}"!`
            : 'Icon fetched and converted successfully!',
        ),
      );
      return resolvedIconPath;
    }

    spinner.warn(`No favicon found for ${domain}. Using default.`);
    return null;
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`Failed to fetch favicon: ${error.message}`);
    }
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, customTimeout || 10000);

  try {
    const response = await fetch(iconUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404 && !showSpinner) {
        return null;
      }
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength < ICON_CONFIG.minFileSize)
      return null;

    const extension = await detectDownloadedIconExtension(
      response,
      arrayBuffer,
      iconUrl,
    );
    if (!extension) {
      return null;
    }

    return await saveIconFile(arrayBuffer, extension);
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (showSpinner) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('Icon download timed out!');
      } else {
        logger.error(
          'Icon download failed!',
          error instanceof Error ? error.message : String(error),
        );
      }
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
