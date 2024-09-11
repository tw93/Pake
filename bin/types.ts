export interface PlatformMap {
  [key: string]: any;
}

export interface PakeCliOptions {
  // Application name
  name?: string;

  // Application icon
  icon: string;

  // Application window width, default 1200px
  width: number;

  // Application window height, default 780px
  height: number;

  // Whether the window is resizable, default true
  resizable: boolean;

  // Whether the window can be fullscreen, default false
  fullscreen: boolean;

  // Enable immersive header, default false.
  hideTitleBar: boolean;

  // Enable windows always on top, default false
  alwaysOnTop: boolean;


  // Force Mac to use dark mode, default false
  darkMode: boolean;

  // Disable web shortcuts, default false
  disabledWebShortcuts: boolean;

  // Set a shortcut key to wake up the app, default empty
  activationShortcut: string;

  // Custom User-Agent, default off
  userAgent: string;

  // Enable system tray, default off for macOS, on for Windows and Linux
  showSystemTray: boolean;

  // Tray icon, default same as app icon for Windows and Linux, macOS requires separate png or ico
  systemTrayIcon: string;

  // Recursive copy, when url is a local file path, if this option is enabled, the url path file and all its subFiles will be copied to the pake static file folder, default off
  useLocalFile: false;

  // Multi arch, supports both Intel and M1 chips, only for Mac
  multiArch: boolean;

  // Package output, valid for Linux users, default is deb, optional appimage, or all (i.e., output both deb and all);
  targets: string;

  // Debug mode, outputs more logs
  debug: boolean;

  /** 需要注入页面的外部脚本 */
  inject: string[];

  /* the domain that can use ipc or tauri javascript sdk */
  safeDomain: string[];

  // Installer language, valid for Windows users, default is en-US
  installerLanguage: string;
}

export interface PakeAppOptions extends PakeCliOptions {
  identifier: string;
}
