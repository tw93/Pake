import { PakeCliOptions } from './types.js';

export const DEFAULT_PAKE_OPTIONS: PakeCliOptions = {
  icon: '',
  height: 780,
  width: 1200,
  fullscreen: false,
  resizable: true,
  hideTitleBar: false,
  alwaysOnTop: false,
  darkMode: false,
  disabledWebShortcuts: false,
  activationShortcut: '',
  userAgent: '',
  showSystemTray: false,
  multiArch: false,
  targets: 'deb',
  useLocalFile: false,
  systemTrayIcon: '',
  debug: false,
  inject: [],
  safeDomain: [],
  installerLanguage: 'en-US',
};

// Just for cli development
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & { url: string } = {
  ...DEFAULT_PAKE_OPTIONS,
  url: 'https://weread.qq.com',
  name: 'WeRead',
  safeDomain: ['weread.qq.com'],
  hideTitleBar: true,
};
