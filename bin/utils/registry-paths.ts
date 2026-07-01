import os from 'os';
import path from 'path';

function getPlatformPath() {
  return process.platform === 'win32' ? path.win32 : path.posix;
}

export function getRegistryDir(): string {
  const platform = process.platform;
  const platformPath = getPlatformPath();

  if (platform === 'linux') {
    return platformPath.join(os.homedir(), '.config', 'pake');
  }

  if (platform === 'darwin') {
    return platformPath.join(
      os.homedir(),
      'Library',
      'Application Support',
      'pake',
    );
  }

  if (platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error('APPDATA environment variable is not set');
    }
    return platformPath.join(appData, 'pake');
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

export function getRegistryPath(): string {
  return getPlatformPath().join(getRegistryDir(), 'history.json');
}
