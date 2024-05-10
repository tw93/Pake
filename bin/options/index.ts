import fsExtra from 'fs-extra';
import logger from '@/options/logger';

import { handleIcon } from './icon';
import { getDomain } from '@/utils/url';
import { getIdentifier, promptText, capitalizeFirstLetter } from '@/utils/info';
import { PakeAppOptions, PakeCliOptions, PlatformMap } from '@/types';

function resolveAppName(name: string, platform: NodeJS.Platform): string {
  const domain = getDomain(name) || 'pake';
  return platform !== 'linux' ? capitalizeFirstLetter(domain) : domain;
}

function isValidName(name: string, platform: NodeJS.Platform): boolean {
  const platformRegexMapping: PlatformMap = {
    linux: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    default: /^[a-zA-Z0-9]+([-a-zA-Z0-9])*$/,
  };
  const reg = platformRegexMapping[platform] || platformRegexMapping.default;
  return !!name && reg.test(name);
}

export default async function handleOptions(options: PakeCliOptions, url: string): Promise<PakeAppOptions> {
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

  if (!isValidName(name, platform)) {
    const LINUX_NAME_ERROR = `✕ name should only include lowercase letters, numbers, and dashes, and must contain at least one lowercase letter. Examples: com-123-xxx, 123pan, pan123, weread, we-read.`;
    const DEFAULT_NAME_ERROR = `✕ Name should only include letters and numbers, and dashes (dashes must not at the beginning), and must contain at least one letter. Examples: 123pan, 123Pan, Pan123, weread, WeRead, WERead, we-read.`;
    const errorMsg = platform === 'linux' ? LINUX_NAME_ERROR : DEFAULT_NAME_ERROR;
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

  appOptions.icon = await handleIcon(appOptions);

  return appOptions;
}
