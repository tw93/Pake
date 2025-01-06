import path from 'path';
import fsExtra from 'fs-extra';

import { npmDirectory } from '@/utils/dir';
import combineFiles from '@/utils/combine';
import logger from '@/options/logger';
import { PakeAppOptions, PlatformMap } from '@/types';
import { tauriConfigDirectory } from '@/utils/dir';

export async function mergeConfig(url: string, options: PakeAppOptions, tauriConf: any) {
  const {
    width,
    height,
    fullscreen,
    hideTitleBar,
    alwaysOnTop,
    appVersion,
    darkMode,
    disabledWebShortcuts,
    activationShortcut,
    userAgent,
    showSystemTray,
    systemTrayIcon,
    useLocalFile,
    identifier,
    name,
    resizable = true,
    inject,
    proxyUrl,
    installerLanguage,
  } = options;

  const { platform } = process;

  // Set Windows parameters.
  const tauriConfWindowOptions = {
    width,
    height,
    fullscreen,
    resizable,
    hide_title_bar: hideTitleBar,
    activation_shortcut: activationShortcut,
    always_on_top: alwaysOnTop,
    dark_mode: darkMode,
    disabled_web_shortcuts: disabledWebShortcuts,
  };
  Object.assign(tauriConf.pake.windows[0], { url, ...tauriConfWindowOptions });

  tauriConf.productName = name;
  tauriConf.identifier = identifier;
  tauriConf.version = appVersion;

  if (platform == 'win32') {
    tauriConf.bundle.windows.wix.language[0] = installerLanguage;
  }

  //Judge the type of URL, whether it is a file or a website.
  const pathExists = await fsExtra.pathExists(url);
  if (pathExists) {
    logger.warn('✼ Your input might be a local file.');
    tauriConf.pake.windows[0].url_type = 'local';

    const fileName = path.basename(url);
    const dirName = path.dirname(url);

    const distDir = path.join(npmDirectory, 'dist');
    const distBakDir = path.join(npmDirectory, 'dist_bak');

    if (!useLocalFile) {
      const urlPath = path.join(distDir, fileName);
      await fsExtra.copy(url, urlPath);
    } else {
      fsExtra.moveSync(distDir, distBakDir, { overwrite: true });
      fsExtra.copySync(dirName, distDir, { overwrite: true });

      // ignore it, because about_pake.html have be erased.
      // const filesToCopyBack = ['cli.js', 'about_pake.html'];
      const filesToCopyBack = ['cli.js'];
      await Promise.all(filesToCopyBack.map(file => fsExtra.copy(path.join(distBakDir, file), path.join(distDir, file))));
    }

    tauriConf.pake.windows[0].url = fileName;
    tauriConf.pake.windows[0].url_type = 'local';
  } else {
    tauriConf.pake.windows[0].url_type = 'web';
  }

  const platformMap: PlatformMap = {
    win32: 'windows',
    linux: 'linux',
    darwin: 'macos',
  };
  const currentPlatform = platformMap[platform];

  if (userAgent.length > 0) {
    tauriConf.pake.user_agent[currentPlatform] = userAgent;
  }

  tauriConf.pake.system_tray[currentPlatform] = showSystemTray;

  // Processing targets are currently only open to Linux.
  if (platform === 'linux') {
    delete tauriConf.bundle.linux.deb.files;
    const validTargets = ['deb', 'appimage', 'rpm'];
    if (validTargets.includes(options.targets)) {
      tauriConf.bundle.targets = [options.targets];
    } else {
      logger.warn(`✼ The target must be one of ${validTargets.join(', ')}, the default 'deb' will be used.`);
    }
  }

  // Set icon.
  const platformIconMap: PlatformMap = {
    win32: {
      fileExt: '.ico',
      path: `png/${name.toLowerCase()}_256.ico`,
      defaultIcon: 'png/icon_256.ico',
      message: 'Windows icon must be .ico and 256x256px.',
    },
    linux: {
      fileExt: '.png',
      path: `png/${name.toLowerCase()}_512.png`,
      defaultIcon: 'png/icon_512.png',
      message: 'Linux icon must be .png and 512x512px.',
    },
    darwin: {
      fileExt: '.icns',
      path: `icons/${name.toLowerCase()}.icns`,
      defaultIcon: 'icons/icon.icns',
      message: 'macOS icon must be .icns type.',
    },
  };
  const iconInfo = platformIconMap[platform];
  const exists = await fsExtra.pathExists(options.icon);
  if (exists) {
    let updateIconPath = true;
    let customIconExt = path.extname(options.icon).toLowerCase();

    if (customIconExt !== iconInfo.fileExt) {
      updateIconPath = false;
      logger.warn(`✼ ${iconInfo.message}, but you give ${customIconExt}`);
      tauriConf.bundle.icon = [iconInfo.defaultIcon];
    } else {
      const iconPath = path.join(npmDirectory, 'src-tauri/', iconInfo.path);
      tauriConf.bundle.resources = [iconInfo.path];
      await fsExtra.copy(options.icon, iconPath);
    }

    if (updateIconPath) {
      tauriConf.bundle.icon = [options.icon];
    } else {
      logger.warn(`✼ Icon will remain as default.`);
    }
  } else {
    logger.warn('✼ Custom icon path may be invalid, default icon will be used instead.');
    tauriConf.bundle.icon = [iconInfo.defaultIcon];
  }

  // Set tray icon path.
  let trayIconPath = platform === 'darwin' ? 'png/icon_512.png' : tauriConf.bundle.icon[0];
  if (systemTrayIcon.length > 0) {
    try {
      await fsExtra.pathExists(systemTrayIcon);
      // 需要判断图标格式，默认只支持ico和png两种
      let iconExt = path.extname(systemTrayIcon).toLowerCase();
      if (iconExt == '.png' || iconExt == '.ico') {
        const trayIcoPath = path.join(npmDirectory, `src-tauri/png/${name.toLowerCase()}${iconExt}`);
        trayIconPath = `png/${name.toLowerCase()}${iconExt}`;
        await fsExtra.copy(systemTrayIcon, trayIcoPath);
      } else {
        logger.warn(`✼ System tray icon must be .ico or .png, but you provided ${iconExt}.`);
        logger.warn(`✼ Default system tray icon will be used.`);
      }
    } catch {
      logger.warn(`✼ ${systemTrayIcon} not exists!`);
      logger.warn(`✼ Default system tray icon will remain unchanged.`);
    }
  }

  tauriConf.app.trayIcon.iconPath = trayIconPath;
  tauriConf.pake.system_tray_path = trayIconPath;

  delete tauriConf.app.trayIcon;

  const injectFilePath = path.join(npmDirectory, `src-tauri/src/inject/custom.js`);

  // inject js or css files
  if (inject?.length > 0) {
    if (!inject.every(item => item.endsWith('.css') || item.endsWith('.js'))) {
      logger.error('The injected file must be in either CSS or JS format.');
      return;
    }
    const files = inject.map(filepath => (path.isAbsolute(filepath) ? filepath : path.join(process.cwd(), filepath)));
    tauriConf.pake.inject = files;
    await combineFiles(files, injectFilePath);
  } else {
    tauriConf.pake.inject = [];
    await fsExtra.writeFile(injectFilePath, '');
  }
  tauriConf.pake.proxy_url = proxyUrl || '';

  // Save config file.
  const platformConfigPaths: PlatformMap = {
    win32: 'tauri.windows.conf.json',
    darwin: 'tauri.macos.conf.json',
    linux: 'tauri.linux.conf.json',
  };

  const configPath = path.join(tauriConfigDirectory, platformConfigPaths[platform]);

  const bundleConf = { bundle: tauriConf.bundle };
  console.log('pakeConfig', tauriConf.pake);
  await fsExtra.outputJSON(configPath, bundleConf, { spaces: 4 });
  const pakeConfigPath = path.join(tauriConfigDirectory, 'pake.json');
  await fsExtra.outputJSON(pakeConfigPath, tauriConf.pake, { spaces: 4 });

  let tauriConf2 = JSON.parse(JSON.stringify(tauriConf));
  delete tauriConf2.pake;

  // delete tauriConf2.bundle;
  if (process.env.NODE_ENV === 'development') {
    tauriConf2.bundle = bundleConf.bundle;
  }
  const configJsonPath = path.join(tauriConfigDirectory, 'tauri.conf.json');
  await fsExtra.outputJSON(configJsonPath, tauriConf2, { spaces: 4 });
}
