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

  // Enable immersive header, default false
  transparent: boolean;

  // Custom User-Agent, default off
  userAgent: string;

  // Enable menu bar, default on for macOS, off for Windows and Linux
  showMenu: boolean;

  // Enable system tray, default off for macOS, on for Windows and Linux
  showSystemTray: boolean;

  // Tray icon, default same as app icon for Windows and Linux, macOS requires separate png or ico
  systemTrayIcon: string;

  // Recursive copy, when url is a local file path, if this option is enabled, the url path file and all its subfiles will be copied to the pake static file folder, default off
  iterCopyFile: false;

  // Multi arch, supports both Intel and M1 chips, only for Mac
  multiArch: boolean;

  // Package output, valid for Linux users, default is deb, optional appimage, or all (i.e., output both deb and all);
  targets: string;

  // Debug mode, outputs more logs
  debug: boolean;
}

export interface PakeAppOptions extends PakeCliOptions {
  identifier: string;
}
