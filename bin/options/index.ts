import path from 'path';
import fsExtra from 'fs-extra';
import logger from '@/options/logger';

import { handleIcon } from './icon';
import { getDomain, safeDomainsToRegex } from '@/utils/url';
import {
  promptText,
  capitalizeFirstLetter,
  resolveIdentifier,
} from '@/utils/info';
import { generateLinuxPackageName } from '@/utils/name';
import { PakeError } from '@/utils/error';
import { isInteractive } from '@/utils/output';
import { PakeAppOptions, PakeCliOptions } from '@/types';

function resolveAppName(name: string, platform: NodeJS.Platform): string {
  const domain = getDomain(name) || 'pake';
  return platform !== 'linux' ? capitalizeFirstLetter(domain) : domain;
}

export function resolveLocalAppName(
  filePath: string,
  platform: NodeJS.Platform,
): string {
  const baseName = path.parse(filePath).name || 'pake-app';
  if (platform === 'linux') {
    return generateLinuxPackageName(baseName) || 'pake-app';
  }
  const normalized = baseName
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff .-]/g, '')
    .replace(/^[ .-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || 'pake-app';
}

export function isValidName(name: string, platform: NodeJS.Platform): boolean {
  const reg =
    platform === 'linux'
      ? /^[a-z0-9\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]*$/
      : /^[a-zA-Z0-9\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff .-]*$/;
  return !!name && reg.test(name);
}

export function validateManagedServerOptions(
  options: PakeCliOptions,
  url: string,
): string | undefined {
  const hasPort = options.serverPort !== undefined;
  const hasCommand = options.serverCommand !== undefined;
  const command = options.serverCommand?.trim();

  if (hasCommand && !command) {
    throw new PakeError('--server-command must not be empty.', {
      code: 'INVALID_INPUT',
      hint: 'Pass the foreground command that starts the local web server.',
    });
  }

  if (hasPort !== hasCommand) {
    throw new PakeError(
      '--server-port and --server-command must be provided together.',
      {
        code: 'INVALID_INPUT',
        hint: 'Pass both options to manage a local server, or omit both.',
      },
    );
  }
  if (!hasPort || !command) return undefined;

  if (options.multiInstance) {
    throw new PakeError(
      '--server-port/--server-command cannot be used with --multi-instance.',
      {
        code: 'INVALID_INPUT',
        hint: 'Use the default single-instance mode so one app process owns the managed server.',
      },
    );
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new PakeError('Managed local servers require an HTTP or HTTPS URL.', {
      code: 'INVALID_INPUT',
      hint: `Use http://127.0.0.1:${options.serverPort} or an equivalent loopback URL.`,
    });
  }

  const hostname = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    !['localhost', '127.0.0.1', '::1'].includes(hostname)
  ) {
    throw new PakeError(
      'Managed local servers require a loopback HTTP or HTTPS URL.',
      {
        code: 'INVALID_INPUT',
        hint: `Use http://127.0.0.1:${options.serverPort}, http://localhost:${options.serverPort}, or the IPv6 loopback equivalent.`,
      },
    );
  }

  const effectivePort = target.port
    ? Number(target.port)
    : target.protocol === 'https:'
      ? 443
      : 80;
  if (effectivePort !== options.serverPort) {
    throw new PakeError(
      `Target URL port ${effectivePort} does not match --server-port ${options.serverPort}.`,
      {
        code: 'INVALID_INPUT',
        hint: 'Use the same port in the target URL and --server-port.',
      },
    );
  }

  options.serverCommand = command;
  return hostname;
}

export default async function handleOptions(
  options: PakeCliOptions,
  url: string,
): Promise<PakeAppOptions> {
  const { platform } = process;
  const isActions = process.env.GITHUB_ACTIONS;
  let name = options.name;
  const serverHost = validateManagedServerOptions(options, url);

  const hasTrafficLightX = options.trafficLightX !== undefined;
  const hasTrafficLightY = options.trafficLightY !== undefined;
  if (hasTrafficLightX !== hasTrafficLightY) {
    throw new PakeError(
      '--traffic-light-x and --traffic-light-y must be provided together.',
      {
        code: 'INVALID_INPUT',
        hint: 'Pass both coordinates or omit both.',
      },
    );
  }

  const pathExists = await fsExtra.pathExists(url);
  if (!options.name) {
    const defaultName = pathExists
      ? resolveLocalAppName(url, platform)
      : resolveAppName(url, platform);
    if (isInteractive()) {
      const promptMessage = 'Enter your application name';
      const namePrompt = await promptText(promptMessage, defaultName);
      name = namePrompt?.trim() || defaultName;
    } else {
      name = defaultName;
    }
  }

  if (name && platform === 'linux') {
    name = generateLinuxPackageName(name);
  }

  if (name && !isValidName(name, platform)) {
    const LINUX_NAME_ERROR = `✕ Name should only include lowercase letters, numbers, and dashes (not leading dashes). Examples: com-123-xxx, 123pan, pan123, weread, we-read, 123.`;
    const DEFAULT_NAME_ERROR = `✕ Name should only include letters, numbers, dots, dashes, and spaces (not leading dots, dashes, and spaces). Examples: 123pan, 123Pan, Pan123, weread, WeRead, WERead, we-read, We Read, Vectorizer.AI, 123.`;
    const errorMsg =
      platform === 'linux' ? LINUX_NAME_ERROR : DEFAULT_NAME_ERROR;
    if (isActions) {
      logger.error(errorMsg);
      name = resolveAppName(url, platform);
      logger.warn(`✼ Inside github actions, use the default name: ${name}`);
    } else {
      throw new PakeError(errorMsg);
    }
  }

  const resolvedName = name || 'pake-app';

  const appOptions: PakeAppOptions = {
    ...options,
    name: resolvedName,
    identifier: resolveIdentifier(url, options.name, options.identifier),
    serverHost,
  };

  // --safe-domain is sugar over --internal-url-regex; an explicit regex wins.
  if (!options.internalUrlRegex && options.safeDomain) {
    appOptions.internalUrlRegex = safeDomainsToRegex(options.safeDomain);
  }

  // --no-bundle is Linux-only; keep normal packaging on other platforms.
  if (appOptions.bundle === false && platform !== 'linux') {
    logger.warn('✼ --no-bundle is only supported on Linux; ignoring it.');
    appOptions.bundle = true;
  }

  const iconPath = await handleIcon(appOptions, url);
  appOptions.icon = iconPath || '';

  return appOptions;
}
