export interface PlatformMap {
  [key: string]: any;
}

export interface PakeCliOptions {
  // Application name
  name?: string;

  // Window title (supports Chinese characters)
  title?: string;

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

  // Start window maximized, default false
  maximize: boolean;

  // Enable immersive header, default false.
  hideTitleBar: boolean;

  // Enable windows always on top, default false
  alwaysOnTop: boolean;

  // App version, the same as package.json version, default 1.0.0
  appVersion: string;

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

  // Build target architecture/format:
  // Linux: "deb", "appimage", "deb-arm64", "appimage-arm64"; Windows: "x64", "arm64"; macOS: "intel", "apple", "universal"
  targets: string;

  // Debug mode, outputs more logs
  debug: boolean;

  /** External scripts that need to be injected into the page. */
  inject: string[];

  // Set Api Proxy
  proxyUrl: string;

  // Installer language, valid for Windows users, default is en-US
  installerLanguage: string;

  // Hide window on close instead of exiting, platform-specific: true for macOS, false for others
  hideOnClose: boolean | undefined;

  // Launch app in incognito/private mode, default false
  incognito: boolean;

  // Enable WebAssembly support (Flutter Web, etc.), default false
  wasm: boolean;

  // Enable drag and drop functionality, default false
  enableDragDrop: boolean;

  // Keep raw binary file alongside installer, default false
  keepBinary: boolean;

  // Allow multiple instances, default false (single instance)
  multiInstance: boolean;

  // Start app minimized to tray, default false
  startToTray: boolean;

  // Force navigation to stay inside the Pake window even for external links
  forceInternalNavigation: boolean;
}

export interface PakeAppOptions extends PakeCliOptions {
  identifier: string;
}
