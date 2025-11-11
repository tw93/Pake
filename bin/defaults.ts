import { PakeCliOptions } from './types.js';

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
  targets: 'deb',
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
  startToTray: false,
  forceInternalNavigation: false,
};

// Just for cli development
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & { url: string } = {
  ...DEFAULT_PAKE_OPTIONS,
  url: 'https://weekly.tw93.fun/',
  name: 'Weekly',
  hideTitleBar: true,
};
