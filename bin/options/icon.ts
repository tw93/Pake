import axios from 'axios';
import { fileTypeFromBuffer } from 'file-type';
import { PakeAppOptions } from '../types.js';
import { dir } from 'tmp-promise';
import path from 'path';
import fs from 'fs/promises';
import logger from './logger.js';
import { npmDirectory } from '@/utils/dir.js';
import { IS_LINUX, IS_WIN } from '@/utils/platform.js';

export async function handleIcon(options: PakeAppOptions, url: string) {
  if (options.icon) {
    if (options.icon.startsWith('http')) {
      return downloadIcon(options.icon);
    } else {
      return path.resolve(options.icon);
    }
  }
  if (!options.icon) {
    return getDefaultIcon();
  }
}

export async function getDefaultIcon() {
  logger.info('You have not provided an app icon, use the default icon.(use --icon option to assign an icon)')
  let iconPath = 'src-tauri/icons/icon.icns';
  if (IS_WIN) {
    iconPath = 'src-tauri/png/icon_256.ico';
  } else if (IS_LINUX) {
    iconPath = 'src-tauri/png/icon_512.png';
  }

  return path.join(npmDirectory, iconPath);
}

export async function downloadIcon(iconUrl: string) {
  let iconResponse;
  try {
    iconResponse = await axios.get(iconUrl, {
      responseType: 'arraybuffer',
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }

  const iconData = await iconResponse.data;
  if (!iconData) {
    return null;
  }
  const fileDetails = await fileTypeFromBuffer(iconData);
  if (!fileDetails) {
    return null;
  }
  const { path } = await dir();
  const iconPath = `${path}/icon.${fileDetails.ext}`;
  await fs.writeFile(iconPath, iconData);
  return iconPath;
}
