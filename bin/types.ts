export interface PakeCliOptions {
  /** 应用名称 */
  name?: string;

  /** 应用icon */
  icon: string;

  /** 应用窗口宽度，默认 1200px */
  width: number;

  /** 应用窗口高度，默认 780px */
  height: number;

  /** 是否可以拖动，默认true */
  resizable: boolean;

  /** 是否可以全屏，默认 false */
  fullscreen: boolean;

  /** 是否开启沉浸式头部，默认为 false 不开启 ƒ*/
  transparent: boolean;

  /** 自定义UA，默认为不开启 ƒ*/
  userAgent: string;

  /** 开启菜单栏，MacOS默认开启，Windows,Linux默认不开启 ƒ*/
  showMenu: boolean;

  /** 开启系统托盘，MacOS默认不开启，Windows,Linux默认开启 ƒ*/
  showSystemTray: boolean;

  /** 托盘图标, Windows、Linux默认和应用图标共用一样的，MacOS需要提别提供, 格式为png或者ico */
  systemTrayIcon: string;

  // /** 递归拷贝，当url为本地文件路径时候，若开启该选项，则将url路径文件所在文件夹以及所有子文件都拷贝到pake静态文件夹，默认不开启 */
  iterCopyFile: false;

  /** mutli arch, Supports both Intel and m1 chips, only for Mac */
  multiArch: boolean;

  // 包输出产物，对linux用户有效，默认为deb，可选appimage, 或者all（即同时输出deb和all）;
  targets: string;

  /** 调试模式，会输出更多日志 */
  debug: boolean;
}

export interface PakeAppOptions extends PakeCliOptions {
  identifier: string;
}

export interface TauriBuildConfig {
  /**
   * the path to the app's dist dir
   * this path must contain your index.html file
   */
  distDir: string
  /**
   * the app's dev server URL, or the path to the directory containing an index.html to open
   */
  devPath: string
  /**
   * a shell command to run before `tauri dev` kicks in
   */
  beforeDevCommand?: string
  /**
   * a shell command to run before `tauri build` kicks in
   */
  beforeBuildCommand?: string
  withGlobalTauri?: boolean
}

type DangerousRemoteDomainIpAccess = {
  domain: string;
  windows: string[];
  enableTauriAPI: boolean;
  schema?: string;
  plugins?: string[];
}

/**
 * Tauri configuration
 */
export interface TauriConfig {
  /**
   * build/dev configuration
   */
  build: TauriBuildConfig
  /**
   * the context of the current `tauri dev` or `tauri build`
   */
  ctx: {
    /**
     * whether we're building for production or not
     */
    prod?: boolean
    /**
     * whether we're running on the dev environment or not
     */
    dev?: boolean
    /**
     * the target of the compilation (see `rustup target list`)
     */
    target?: string
    /**
     * whether the app should be built on debug mode or not
     */
    debug?: boolean
    /**
     * defines we should exit the `tauri dev` process if a Rust code error is found
     */
    exitOnPanic?: boolean
  }
  /**
   * tauri root configuration object
   */
  tauri: {
    /**
     * the embedded server configuration
     */
    embeddedServer: {
      /**
       * whether we should use the embedded-server or the no-server mode
       */
      active?: boolean
      /**
       * the embedded server port number or the 'random' string to generate one at runtime
       */
      port?: number | 'random' | undefined
    }
    /**
     * tauri bundler configuration
     */
    bundle: {
      /**
       * whether we should build your app with tauri-bundler or plain `cargo build`
       */
      active?: boolean
      /**
       * the bundle targets, currently supports ["deb", "osx", "msi", "appimage", "dmg"] or "all"
       */
      targets?: string | string[]
      /**
       * the app's identifier
       */
      identifier: string
      /**
       * the app's icons
       */
      icon: string[]
      /**
       * app resources to bundle
       * each resource is a path to a file or directory
       * glob patterns are supported
       */
      resources?: string[]
      externalBin?: string[]
      copyright?: string
      category?: string
      shortDescription?: string
      longDescription?: string
      deb?: {
        depends?: string[]
        useBootstrapper?: boolean
      }
      osx?: {
        frameworks?: string[]
        minimumSystemVersion?: string
        license?: string
        useBootstrapper?: boolean
      }
      exceptionDomain?: string
    }
    allowlist: {
      all: boolean
      [index: string]: boolean
    }
    window: {
      title: string
      width?: number
      height?: number
      resizable?: boolean
      fullscreen?: boolean
    }
    security: {
      csp?: string,
      dangerousRemoteDomainIpcAccess?: DangerousRemoteDomainIpAccess[]
    }
    inliner: {
      active?: boolean
    }
  }
  plugins?: {
    [name: string]: {
      [key: string]: any
    }
  }
  /**
   * Whether or not to enable verbose logging
   */
  verbose?: boolean
}
