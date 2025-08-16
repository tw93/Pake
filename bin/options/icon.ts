import path from 'path';
import axios from 'axios';
import fsExtra from 'fs-extra';
import { dir } from 'tmp-promise';
import { fileTypeFromBuffer } from 'file-type';
import icongen from 'icon-gen';
import sharp from 'sharp';

import logger from './logger';
import { npmDirectory, getUserHomeDir } from '@/utils/dir';
import { IS_LINUX, IS_WIN } from '@/utils/platform';
import { PakeAppOptions } from '@/types';

// Constants
const ICON_CONFIG = {
  minFileSize: 100,
  downloadTimeout: 10000,
  supportedFormats: ['png', 'ico', 'jpeg', 'jpg', 'webp'] as const,
  whiteBackground: { r: 255, g: 255, b: 255 },
};

// API Configuration
const API_TOKENS = {
  // cspell:disable-next-line
  logoDev: ['pk_JLLMUKGZRpaG5YclhXaTkg', 'pk_Ph745P8mQSeYFfW2Wk039A'],
  // cspell:disable-next-line
  brandfetch: ['1idqvJC0CeFSeyp3Yf7', '1idej-yhU_ThggIHFyG'],
};

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
  } catch {
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
      await icongen(processedInputPath, platformOutputDir, {
        report: false,
        ico: { name: `${iconName}_256`, sizes: [256] },
      });
      return path.join(platformOutputDir, `${iconName}_256.ico`);
    }

    if (IS_LINUX) {
      const outputPath = path.join(platformOutputDir, `${iconName}_512.png`);
      await fsExtra.copy(processedInputPath, outputPath);
      return outputPath;
    }

    // macOS
    await icongen(processedInputPath, platformOutputDir, {
      report: false,
      icns: { name: iconName, sizes: [16, 32, 64, 128, 256, 512, 1024] },
    });
    const outputPath = path.join(platformOutputDir, `${iconName}.icns`);
    return (await fsExtra.pathExists(outputPath)) ? outputPath : null;
  } catch (error) {
    logger.warn(`Icon format conversion failed: ${error.message}`);
    return null;
  }
}

export async function handleIcon(options: PakeAppOptions, url?: string) {
  if (options.icon) {
    if (options.icon.startsWith('http')) {
      return downloadIcon(options.icon);
    }
    return path.resolve(options.icon);
  }

  // Try to get favicon from website if URL is provided
  if (url && url.startsWith('http') && options.name) {
    const faviconPath = await tryGetFavicon(url, options.name);
    if (faviconPath) return faviconPath;
  }

  logger.info('✼ No icon provided, using default icon.');
  const iconPath = IS_WIN
    ? 'src-tauri/png/icon_256.ico'
    : IS_LINUX
      ? 'src-tauri/png/icon_512.png'
      : 'src-tauri/icons/icon.icns';
  return path.join(npmDirectory, iconPath);
}

/**
 * Generates icon service URLs for a domain
 */
function generateIconServiceUrls(domain: string): string[] {
  const logoDevUrls = API_TOKENS.logoDev
    .sort(() => Math.random() - 0.5)
    .map(
      (token) =>
        `https://img.logo.dev/${domain}?token=${token}&format=png&size=256`,
    );

  const brandfetchUrls = API_TOKENS.brandfetch
    .sort(() => Math.random() - 0.5)
    .map((key) => `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${key}`);

  return [
    ...logoDevUrls,
    ...brandfetchUrls,
    `https://logo.clearbit.com/${domain}?size=256`,
    `https://logo.uplead.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    `https://favicon.is/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://icon.horse/icon/${domain}`,
    `https://${domain}/favicon.ico`,
    `https://www.${domain}/favicon.ico`,
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/apple-touch-icon-precomposed.png`,
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
    logger.info(`Auto-fetching favicon for ${domain}...`);

    const serviceUrls = generateIconServiceUrls(domain);

    for (const serviceUrl of serviceUrls) {
      try {
        const faviconPath = await downloadIcon(serviceUrl, false);
        if (!faviconPath) continue;

        const convertedPath = await convertIconFormat(faviconPath, appName);
        if (convertedPath) {
          logger.info(`Favicon ready for ${domain}`);
          return convertedPath;
        }
      } catch {
        continue;
      }
    }

    logger.info(`No favicon found for ${domain}. Using default.`);
    return null;
  } catch {
    return null;
  }
}

/**
 * Downloads icon from URL
 */
export async function downloadIcon(
  iconUrl: string,
  showSpinner = true,
): Promise<string | null> {
  try {
    const response = await axios.get(iconUrl, {
      responseType: 'arraybuffer',
      timeout: ICON_CONFIG.downloadTimeout,
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
 * Saves icon file to .pake directory
 */
async function saveIconFile(
  iconData: ArrayBuffer,
  extension: string,
): Promise<string> {
  const buffer = Buffer.from(iconData);
  const homeDir = getUserHomeDir();
  const pakeDir = path.join(homeDir, '.pake', 'icons');

  // Ensure .pake/icons directory exists
  await fsExtra.ensureDir(pakeDir);

  const iconPath = path.join(pakeDir, `downloaded-icon.${extension}`);
  await fsExtra.outputFile(iconPath, buffer);
  return iconPath;
}
