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

  /** mutli arch, Supports both Intel and m1 chips, only for Mac */
  multiArch: boolean;

  /** Select the output package format, support deb/appimage/all, only for Linux */
  targets: string,
}

export interface PakeAppOptions extends PakeCliOptions {
  identifier: string;
}
