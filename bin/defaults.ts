import { PakeCliOptions } from './types.js';
import { getDefaultLinuxTargets } from './utils/platform.js';

export const DEFAULT_PAKE_OPTIONS: PakeCliOptions = {
  icon: '',
  height: 780,
  width: 1200,
  fullscreen: false,
  maximize: false,
  resizable: true,
  hideTitleBar: false,
  hideWindowDecorations: false,
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
        return getDefaultLinuxTargets();
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
  json: false,
  inject: [],
  installerLanguage: 'en-US',
  hideOnClose: undefined, // Platform-specific: true for macOS, false for others
  incognito: false,
  wasm: false,
  enableDragDrop: false,
  bundle: true,
  keepBinary: false,
  multiInstance: false,
  multiWindow: false,
  startToTray: false,
  forceInternalNavigation: false,
  internalUrlRegex: '',
  safeDomain: '',
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
