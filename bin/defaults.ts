import { PakeCliOptions } from './types.js';

export const DEFAULT_PAKE_OPTIONS: PakeCliOptions = {
  icon: '',
  height: 780,
  width: 1200,
  fullscreen: false,
  resizable: true,
  transparent: false,
  alwaysOnTop: false,
  disabledWebShortcuts: false,
  userAgent: '',
  showSystemTray: false,
  multiArch: false,
  targets: 'deb',
  iterCopyFile: false,
  systemTrayIcon: '',
  debug: false,
  inject: [],
  safeDomain: [],
};

// Just for cli development
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & {url: string} = {
  ...DEFAULT_PAKE_OPTIONS,
  url: 'https://weread.qq.com',
  name: 'WeRead',
  safeDomain:['weread.qq.com'],
  transparent: true,
}
