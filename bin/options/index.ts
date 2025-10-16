import fsExtra from 'fs-extra';
import logger from '@/options/logger';

import { handleIcon } from './icon';
import { getDomain } from '@/utils/url';
import { getIdentifier, promptText, capitalizeFirstLetter } from '@/utils/info';
import { generateLinuxPackageName } from '@/utils/name';
import { PakeAppOptions, PakeCliOptions, PlatformMap } from '@/types';

function resolveAppName(name: string, platform: NodeJS.Platform): string {
  const domain = getDomain(name) || 'pake';
  return platform !== 'linux' ? capitalizeFirstLetter(domain) : domain;
}

function isValidName(name: string, platform: NodeJS.Platform): boolean {
  const platformRegexMapping: PlatformMap = {
    linux: /^[a-z0-9\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]*$/,
    default: /^[a-zA-Z0-9\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff- ]*$/,
  };
  const reg = platformRegexMapping[platform] || platformRegexMapping.default;
  return !!name && reg.test(name);
}

export default async function handleOptions(
  options: PakeCliOptions,
  url: string,
): Promise<PakeAppOptions> {
  const { platform } = process;
  const isActions = process.env.GITHUB_ACTIONS;
  let name = options.name;

  const pathExists = await fsExtra.pathExists(url);
  if (!options.name) {
    const defaultName = pathExists ? '' : resolveAppName(url, platform);
    const promptMessage = 'Enter your application name';
    const namePrompt = await promptText(promptMessage, defaultName);
    name = namePrompt || defaultName;
  }

  if (name && platform === 'linux') {
    name = generateLinuxPackageName(name);
  }

  if (!isValidName(name, platform)) {
    const LINUX_NAME_ERROR = `✕ Name should only include lowercase letters, numbers, and dashes (not leading dashes). Examples: com-123-xxx, 123pan, pan123, weread, we-read, 123.`;
    const DEFAULT_NAME_ERROR = `✕ Name should only include letters, numbers, dashes, and spaces (not leading dashes and spaces). Examples: 123pan, 123Pan, Pan123, weread, WeRead, WERead, we-read, We Read, 123.`;
    const errorMsg =
      platform === 'linux' ? LINUX_NAME_ERROR : DEFAULT_NAME_ERROR;
    logger.error(errorMsg);
    if (isActions) {
      name = resolveAppName(url, platform);
      logger.warn(`✼ Inside github actions, use the default name: ${name}`);
    } else {
      process.exit(1);
    }
  }

  const appOptions: PakeAppOptions = {
    ...options,
    name,
    identifier: getIdentifier(url),
  };

  const iconPath = await handleIcon(appOptions, url);
  appOptions.icon = iconPath || undefined;

  return appOptions;
}
