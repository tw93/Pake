import os from 'os';
import path from 'path';

export interface AppDataPaths {
  config: string;
  cache: string;
}

const MAX_PRODUCT_NAME_LENGTH = 200;

function getPlatformPath() {
  return process.platform === 'win32' ? path.win32 : path;
}

export function validateProductName(name: string): string {
  if (name === '' || name.trim() === '') {
    throw new Error(
      `Invalid product name "${name}": cannot be empty or whitespace-only`,
    );
  }

  if (name.length > MAX_PRODUCT_NAME_LENGTH) {
    throw new Error(
      `Invalid product name "${name}": exceeds ${MAX_PRODUCT_NAME_LENGTH} characters`,
    );
  }

  if (name.includes('\0')) {
    throw new Error(`Invalid product name "${name}": cannot contain NUL bytes`);
  }

  if (name.includes('/') || name.includes('\\')) {
    throw new Error(
      `Invalid product name "${name}": cannot contain path separators`,
    );
  }

  if (name.includes('..')) {
    throw new Error(`Invalid product name "${name}": cannot contain ".."`);
  }

  return name;
}

export function getAppDataPaths(productName: string): AppDataPaths {
  const validatedName = validateProductName(productName);
  const platform = process.platform;
  const platformPath = getPlatformPath();

  if (platform === 'linux') {
    return {
      config: platformPath.join(os.homedir(), '.config', validatedName),
      cache: platformPath.join(os.homedir(), '.cache', validatedName),
    };
  }

  if (platform === 'darwin') {
    return {
      config: platformPath.join(
        os.homedir(),
        'Library',
        'Application Support',
        validatedName,
      ),
      cache: platformPath.join(
        os.homedir(),
        'Library',
        'Caches',
        validatedName,
      ),
    };
  }

  if (platform === 'win32') {
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;

    if (!appData) {
      throw new Error('APPDATA environment variable is not set');
    }
    if (!localAppData) {
      throw new Error('LOCALAPPDATA environment variable is not set');
    }

    return {
      config: platformPath.join(appData, validatedName),
      cache: platformPath.join(localAppData, validatedName),
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}
