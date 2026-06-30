import os from 'os';
import path from 'path';

export interface AppDataPaths {
  config: string;
  cache: string;
}

function getPlatformPath() {
  return process.platform === 'win32' ? path.win32 : path;
}

export function getAppDataPaths(productName: string): AppDataPaths {
  const platform = process.platform;
  const platformPath = getPlatformPath();

  if (platform === 'linux') {
    return {
      config: platformPath.join(os.homedir(), '.config', productName),
      cache: platformPath.join(os.homedir(), '.cache', productName),
    };
  }

  if (platform === 'darwin') {
    return {
      config: platformPath.join(
        os.homedir(),
        'Library',
        'Application Support',
        productName,
      ),
      cache: platformPath.join(os.homedir(), 'Library', 'Caches', productName),
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
      config: platformPath.join(appData, productName),
      cache: platformPath.join(localAppData, productName),
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}
