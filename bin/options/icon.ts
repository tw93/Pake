import { getSpinner } from "@/utils/info";
import path from 'path';
import axios from 'axios';
import fsExtra from "fs-extra";
import { dir } from 'tmp-promise';
import { fileTypeFromBuffer } from 'file-type';

import logger from './logger';
import { npmDirectory } from '@/utils/dir';
import { IS_LINUX, IS_WIN } from '@/utils/platform';
import { PakeAppOptions } from '@/types';

export async function handleIcon(options: PakeAppOptions) {
  if (options.icon) {
    if (options.icon.startsWith('http')) {
      return downloadIcon(options.icon);
    } else {
      return path.resolve(options.icon);
    }
  } else {
    logger.info('No app icon provided, default icon used. Use --icon option to assign an icon.');
    const iconPath = IS_WIN ? 'src-tauri/png/icon_256.ico' : IS_LINUX ? 'src-tauri/png/icon_512.png' : 'src-tauri/icons/icon.icns';
    return path.join(npmDirectory, iconPath);
  }
}

export async function downloadIcon(iconUrl: string) {
  const spinner = getSpinner('Downloading icon.');
  try {
    const iconResponse = await axios.get(iconUrl, { responseType: 'arraybuffer' });
    const iconData = await iconResponse.data;

    if (!iconData) {
      return null;
    }

    const fileDetails = await fileTypeFromBuffer(iconData);
    if (!fileDetails) {
      return null;
    }

    const { path: tempPath } = await dir();
    const iconPath = `${tempPath}/icon.${fileDetails.ext}`;
    await fsExtra.outputFile(iconPath, iconData);
    spinner.succeed('Icon downloaded successfully.');
    return iconPath;
  } catch (error) {
    spinner.fail('Icon download failed.');
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
}
