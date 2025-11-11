import path from 'path';
import fsExtra from 'fs-extra';

import combineFiles from '@/utils/combine';
import logger from '@/options/logger';
import { generateSafeFilename, generateIdentifierSafeName } from '@/utils/name';
import { PakeAppOptions, PlatformMap } from '@/types';
import { tauriConfigDirectory, npmDirectory } from '@/utils/dir';

/**
 * Helper function to generate safe lowercase app name for file paths
 */
function getSafeAppName(name: string): string {
  return generateSafeFilename(name).toLowerCase();
}

export async function mergeConfig(
  url: string,
  options: PakeAppOptions,
  tauriConf: any,
) {
  // Ensure .pake directory exists and copy source templates if needed
  const srcTauriDir = path.join(npmDirectory, 'src-tauri');
  await fsExtra.ensureDir(tauriConfigDirectory);

  // Copy source config files to .pake directory (as templates)
  const sourceFiles = [
    'tauri.conf.json',
    'tauri.macos.conf.json',
    'tauri.windows.conf.json',
    'tauri.linux.conf.json',
    'pake.json',
  ];

  await Promise.all(
    sourceFiles.map(async (file) => {
      const sourcePath = path.join(srcTauriDir, file);
      const destPath = path.join(tauriConfigDirectory, file);

      if (
        (await fsExtra.pathExists(sourcePath)) &&
        !(await fsExtra.pathExists(destPath))
      ) {
        await fsExtra.copy(sourcePath, destPath);
      }
    }),
  );
  const {
    width,
    height,
    fullscreen,
    maximize,
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
    hideOnClose,
    incognito,
    title,
    wasm,
    enableDragDrop,
    multiInstance,
    startToTray,
    forceInternalNavigation,
  } = options;

  const { platform } = process;

  const platformHideOnClose = hideOnClose ?? platform === 'darwin';

  const tauriConfWindowOptions = {
    width,
    height,
    fullscreen,
    maximize,
    resizable,
    hide_title_bar: hideTitleBar,
    activation_shortcut: activationShortcut,
    always_on_top: alwaysOnTop,
    dark_mode: darkMode,
    disabled_web_shortcuts: disabledWebShortcuts,
    hide_on_close: platformHideOnClose,
    incognito: incognito,
    title: title || null,
    enable_wasm: wasm,
    enable_drag_drop: enableDragDrop,
    start_to_tray: startToTray && showSystemTray,
    force_internal_navigation: forceInternalNavigation,
  };
  Object.assign(tauriConf.pake.windows[0], { url, ...tauriConfWindowOptions });

  tauriConf.productName = name;
  tauriConf.identifier = identifier;
  tauriConf.version = appVersion;

  if (platform === 'linux') {
    tauriConf.mainBinaryName = `pake-${generateIdentifierSafeName(name)}`;
  }

  if (platform == 'win32') {
    tauriConf.bundle.windows.wix.language[0] = installerLanguage;
  }

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
      await Promise.all(
        filesToCopyBack.map((file) =>
          fsExtra.copy(path.join(distBakDir, file), path.join(distDir, file)),
        ),
      );
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
    // Remove hardcoded desktop files and regenerate with correct app name
    delete tauriConf.bundle.linux.deb.files;

    // Generate correct desktop file configuration
    const appNameSafe = getSafeAppName(name);
    const identifier = `com.pake.${appNameSafe}`;
    const desktopFileName = `${identifier}.desktop`;

    // Create desktop file content
    const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${name}
Comment=${name}
Exec=pake-${appNameSafe}
Icon=${appNameSafe}_512
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml_xml;
StartupNotify=true
`;

    // Write desktop file to src-tauri/assets directory where Tauri expects it
    const srcAssetsDir = path.join(npmDirectory, 'src-tauri/assets');
    const srcDesktopFilePath = path.join(srcAssetsDir, desktopFileName);
    await fsExtra.ensureDir(srcAssetsDir);
    await fsExtra.writeFile(srcDesktopFilePath, desktopContent);

    // Set up desktop file in bundle configuration
    // Use absolute path from src-tauri directory to assets
    tauriConf.bundle.linux.deb.files = {
      [`/usr/share/applications/${desktopFileName}`]: `assets/${desktopFileName}`,
    };

    const validTargets = [
      'deb',
      'appimage',
      'rpm',
      'deb-arm64',
      'appimage-arm64',
      'rpm-arm64',
    ];
    const baseTarget = options.targets.includes('-arm64')
      ? options.targets.replace('-arm64', '')
      : options.targets;

    if (validTargets.includes(options.targets)) {
      tauriConf.bundle.targets = [baseTarget];
    } else {
      logger.warn(
        `✼ The target must be one of ${validTargets.join(', ')}, the default 'deb' will be used.`,
      );
    }
  }

  // Set macOS bundle targets (for app vs dmg)
  if (platform === 'darwin') {
    const validMacTargets = ['app', 'dmg'];
    if (validMacTargets.includes(options.targets)) {
      tauriConf.bundle.targets = [options.targets];
    }
  }

  // Set icon.
  const safeAppName = getSafeAppName(name);
  const platformIconMap: PlatformMap = {
    win32: {
      fileExt: '.ico',
      path: `png/${safeAppName}_256.ico`,
      defaultIcon: 'png/icon_256.ico',
      message: 'Windows icon must be .ico and 256x256px.',
    },
    linux: {
      fileExt: '.png',
      path: `png/${safeAppName}_512.png`,
      defaultIcon: 'png/icon_512.png',
      message: 'Linux icon must be .png and 512x512px.',
    },
    darwin: {
      fileExt: '.icns',
      path: `icons/${safeAppName}.icns`,
      defaultIcon: 'icons/icon.icns',
      message: 'macOS icon must be .icns type.',
    },
  };
  const iconInfo = platformIconMap[platform];
  const resolvedIconPath = options.icon ? path.resolve(options.icon) : null;
  const exists =
    resolvedIconPath && (await fsExtra.pathExists(resolvedIconPath));
  if (exists) {
    let updateIconPath = true;
    let customIconExt = path.extname(resolvedIconPath).toLowerCase();

    if (customIconExt !== iconInfo.fileExt) {
      updateIconPath = false;
      logger.warn(`✼ ${iconInfo.message}, but you give ${customIconExt}`);
      tauriConf.bundle.icon = [iconInfo.defaultIcon];
    } else {
      const iconPath = path.join(npmDirectory, 'src-tauri/', iconInfo.path);
      tauriConf.bundle.resources = [iconInfo.path];

      // Avoid copying if source and destination are the same
      const absoluteDestPath = path.resolve(iconPath);
      if (resolvedIconPath !== absoluteDestPath) {
        await fsExtra.copy(resolvedIconPath, iconPath);
      }
    }

    if (updateIconPath) {
      tauriConf.bundle.icon = [iconInfo.path];
    } else {
      logger.warn(`✼ Icon will remain as default.`);
    }
  } else {
    logger.warn(
      '✼ Custom icon path may be invalid, default icon will be used instead.',
    );
    tauriConf.bundle.icon = [iconInfo.defaultIcon];
  }

  // Set tray icon path.
  let trayIconPath =
    platform === 'darwin' ? 'png/icon_512.png' : tauriConf.bundle.icon[0];
  if (systemTrayIcon.length > 0) {
    try {
      await fsExtra.pathExists(systemTrayIcon);
      // 需要判断图标格式，默认只支持ico和png两种
      let iconExt = path.extname(systemTrayIcon).toLowerCase();
      if (iconExt == '.png' || iconExt == '.ico') {
        const trayIcoPath = path.join(
          npmDirectory,
          `src-tauri/png/${safeAppName}${iconExt}`,
        );
        trayIconPath = `png/${safeAppName}${iconExt}`;
        await fsExtra.copy(systemTrayIcon, trayIcoPath);
      } else {
        logger.warn(
          `✼ System tray icon must be .ico or .png, but you provided ${iconExt}.`,
        );
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

  const injectFilePath = path.join(
    npmDirectory,
    `src-tauri/src/inject/custom.js`,
  );

  // inject js or css files
  if (inject?.length > 0) {
    // Ensure inject is an array before calling .every()
    const injectArray = Array.isArray(inject) ? inject : [inject];
    if (
      !injectArray.every(
        (item) => item.endsWith('.css') || item.endsWith('.js'),
      )
    ) {
      logger.error('The injected file must be in either CSS or JS format.');
      return;
    }
    const files = injectArray.map((filepath) =>
      path.isAbsolute(filepath) ? filepath : path.join(process.cwd(), filepath),
    );
    tauriConf.pake.inject = files;
    await combineFiles(files, injectFilePath);
  } else {
    tauriConf.pake.inject = [];
    await fsExtra.writeFile(injectFilePath, '');
  }
  tauriConf.pake.proxy_url = proxyUrl || '';
  tauriConf.pake.multi_instance = multiInstance;

  // Configure WASM support with required HTTP headers
  if (wasm) {
    tauriConf.app.security = {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    };
  }

  // Save config file.
  const platformConfigPaths: PlatformMap = {
    win32: 'tauri.windows.conf.json',
    darwin: 'tauri.macos.conf.json',
    linux: 'tauri.linux.conf.json',
  };

  const configPath = path.join(
    tauriConfigDirectory,
    platformConfigPaths[platform],
  );

  const bundleConf = { bundle: tauriConf.bundle };
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
