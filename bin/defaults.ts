import fs from 'fs';
import { PakeCliOptions } from './types.js';

function isArchLinuxBased(): boolean {
  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase();
    return osRelease.includes('id=arch') || osRelease.includes('id_like=arch');
  } catch {
    return false;
  }
}

export const DEFAULT_PAKE_OPTIONS: PakeCliOptions = {
  icon: '',
  height: 780,
  width: 1200,
  fullscreen: false,
  maximize: false,
  resizable: true,
  hideTitleBar: false,
  alwaysOnTop: false,
  appVersion: '1.0.0',
  darkMode: false,
  disabledWebShortcuts: false,
  activationShortcut: '',
  userAgent: '',
  showSystemTray: false,
  multiArch: false,
  targets: (() => {
    switch (process.platform) {
      case 'linux':
        return isArchLinuxBased() ? 'zst' : 'deb,appimage';
      case 'darwin':
        return 'dmg';
      case 'win32':
        return 'msi';
      default:
        return 'deb';
    }
  })(),
  useLocalFile: false,
  systemTrayIcon: '',
  proxyUrl: '',
  debug: false,
  inject: [],
  installerLanguage: 'en-US',
  hideOnClose: undefined, // Platform-specific: true for macOS, false for others
  incognito: false,
  wasm: false,
  enableDragDrop: false,
  keepBinary: false,
  multiInstance: false,
  multiWindow: false,
  startToTray: false,
  forceInternalNavigation: false,
  internalUrlRegex: '',
  enableFind: false,
  iterativeBuild: false,
  zoom: 100,
  minWidth: 0,
  minHeight: 0,
  ignoreCertificateErrors: false,
  newWindow: false,
  install: false,
  camera: false,
  microphone: false,
};

// Just for cli development
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & { url: string } = {
  ...DEFAULT_PAKE_OPTIONS,
  url: 'https://weekly.tw93.fun/en',
  name: 'Weekly',
  hideTitleBar: true,
};
