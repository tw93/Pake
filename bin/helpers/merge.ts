import path from 'path';
import fsExtra from 'fs-extra';

import combineFiles from '@/utils/combine';
import logger from '@/options/logger';
import {
  generateSafeFilename,
  generateIdentifierSafeName,
  getSafeAppName,
  generateLinuxPackageName,
} from '@/utils/name';
import {
  PakeAppOptions,
  PakeTauriConfig,
  SupportedPlatform,
  TauriPlatform,
  WindowConfig,
} from '@/types';
import { tauriConfigDirectory, npmDirectory } from '@/utils/dir';

type PlatformIconInfo = {
  fileExt: string;
  path: string;
  defaultIcon: string;
  message: string;
};

function asSupportedPlatform(platform: NodeJS.Platform): SupportedPlatform {
  if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') {
    throw new Error(
      `Pake only supports win32, darwin, and linux; detected '${platform}'.`,
    );
  }
  return platform;
}

async function copyTemplateConfigs(): Promise<void> {
  const srcTauriDir = path.join(npmDirectory, 'src-tauri');
  await fsExtra.ensureDir(tauriConfigDirectory);

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
}

async function handleLocalFile(
  url: string,
  useLocalFile: boolean,
  tauriConf: PakeTauriConfig,
): Promise<void> {
  const pathExists = await fsExtra.pathExists(url);
  if (pathExists) {
    logger.warn('✼ Your input might be a local file.');

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
}

async function mergeLinuxConfig(
  options: PakeAppOptions,
  name: string,
  tauriConf: PakeTauriConfig,
  linuxBinaryName: string,
): Promise<void> {
  const linuxBundle = tauriConf.bundle.linux;
  if (!linuxBundle) {
    throw new Error(
      'Linux bundle configuration is missing from tauri.linux.conf.json; cannot build Linux target.',
    );
  }
  delete linuxBundle.deb.files;

  const linuxName = generateLinuxPackageName(name);
  const desktopFileName = `com.pake.${linuxName}.desktop`;
  const iconName = `${linuxName}_512`;
  const { title } = options;

  const chineseName = title && /[\u4e00-\u9fa5]/.test(title) ? title : null;
  const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${name}
${chineseName ? `Name[zh_CN]=${chineseName}` : ''}
Comment=${name}
Exec=${linuxBinaryName}
Icon=${iconName}
Categories=Network;WebBrowser;Utility;
MimeType=text/html;text/xml;application/xhtml_xml;
StartupNotify=true
Terminal=false
`;

  const srcAssetsDir = path.join(npmDirectory, 'src-tauri/assets');
  const srcDesktopFilePath = path.join(srcAssetsDir, desktopFileName);
  await fsExtra.ensureDir(srcAssetsDir);
  await fsExtra.writeFile(srcDesktopFilePath, desktopContent);

  const desktopInstallPath = `/usr/share/applications/${desktopFileName}`;
  linuxBundle.deb.files = {
    [desktopInstallPath]: `assets/${desktopFileName}`,
  };

  if (!linuxBundle.rpm) {
    linuxBundle.rpm = {};
  }
  linuxBundle.rpm.files = {
    [desktopInstallPath]: `assets/${desktopFileName}`,
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

async function mergeIcons(
  options: PakeAppOptions,
  name: string,
  tauriConf: PakeTauriConfig,
  platform: SupportedPlatform,
  safeAppName: string,
): Promise<void> {
  const platformIconMap: Record<SupportedPlatform, PlatformIconInfo> = {
    win32: {
      fileExt: '.ico',
      path: `png/${safeAppName}_256.ico`,
      defaultIcon: 'png/icon_256.ico',
      message: 'Windows icon must be .ico and 256x256px.',
    },
    linux: {
      fileExt: '.png',
      path: `png/${generateLinuxPackageName(name)}_512.png`,
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
    const customIconExt = path.extname(resolvedIconPath).toLowerCase();

    if (customIconExt !== iconInfo.fileExt) {
      updateIconPath = false;
      logger.warn(`✼ ${iconInfo.message}, but you give ${customIconExt}`);
      tauriConf.bundle.icon = [iconInfo.defaultIcon];
    } else {
      const iconPath = path.join(npmDirectory, 'src-tauri/', iconInfo.path);
      tauriConf.bundle.resources = [iconInfo.path];

      const absoluteDestPath = path.resolve(iconPath);
      if (resolvedIconPath !== absoluteDestPath) {
        try {
          await fsExtra.copy(resolvedIconPath, iconPath);
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              error.message.includes(
                'Source and destination must not be the same',
              )
            )
          ) {
            throw error;
          }
        }
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
    platform === 'darwin' ? 'png/icon_512.png' : tauriConf.bundle.icon![0];
  if (options.systemTrayIcon.length > 0) {
    try {
      await fsExtra.pathExists(options.systemTrayIcon);
      const iconExt = path.extname(options.systemTrayIcon).toLowerCase();
      if (iconExt === '.png' || iconExt === '.ico') {
        const trayIcoPath = path.join(
          npmDirectory,
          `src-tauri/png/${safeAppName}${iconExt}`,
        );
        trayIconPath = `png/${safeAppName}${iconExt}`;
        await fsExtra.copy(options.systemTrayIcon, trayIcoPath);
      } else {
        logger.warn(
          `✼ System tray icon must be .ico or .png, but you provided ${iconExt}.`,
        );
        logger.warn(`✼ Default system tray icon will be used.`);
      }
    } catch (err) {
      logger.warn(
        `✼ Failed to apply system tray icon "${options.systemTrayIcon}": ${err instanceof Error ? err.message : String(err)}`,
      );
      logger.warn(`✼ Default system tray icon will remain unchanged.`);
    }
  }

  tauriConf.pake.system_tray_path = trayIconPath;
  delete tauriConf.app.trayIcon;
}

async function injectCustomCode(
  options: PakeAppOptions,
  tauriConf: PakeTauriConfig,
): Promise<void> {
  const { inject, proxyUrl, multiInstance, multiWindow, wasm } = options;
  const injectFilePath = path.join(
    npmDirectory,
    'src-tauri/src/inject/custom.js',
  );

  if (inject?.length > 0) {
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
  tauriConf.pake.multi_window = multiWindow;

  if (wasm) {
    tauriConf.app.security = {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    };
  }
}

async function generateMacEntitlements(
  camera: boolean,
  microphone: boolean,
): Promise<void> {
  const entitlementEntries: string[] = [];
  if (camera) {
    entitlementEntries.push(
      '    <key>com.apple.security.device.camera</key>\n    <true/>',
    );
  }
  if (microphone) {
    entitlementEntries.push(
      '    <key>com.apple.security.device.audio-input</key>\n    <true/>',
    );
  }
  const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
${entitlementEntries.join('\n')}
  </dict>
</plist>
`;
  const entitlementsPath = path.join(
    npmDirectory,
    'src-tauri',
    'entitlements.plist',
  );
  await fsExtra.writeFile(entitlementsPath, entitlementsContent);
}

async function writeAllConfigs(
  tauriConf: PakeTauriConfig,
  platform: SupportedPlatform,
): Promise<void> {
  const platformConfigPaths: Record<SupportedPlatform, string> = {
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

  const tauriConf2 = JSON.parse(JSON.stringify(tauriConf));
  delete tauriConf2.pake;
  if (process.env.NODE_ENV === 'development') {
    tauriConf2.bundle = bundleConf.bundle;
  }
  const configJsonPath = path.join(tauriConfigDirectory, 'tauri.conf.json');
  await fsExtra.outputJSON(configJsonPath, tauriConf2, { spaces: 4 });
}

export async function mergeConfig(
  url: string,
  options: PakeAppOptions,
  tauriConf: PakeTauriConfig,
) {
  await copyTemplateConfigs();

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
    useLocalFile,
    identifier,
    name = 'pake-app',
    resizable = true,
    installerLanguage,
    hideOnClose,
    incognito,
    title,
    wasm,
    enableDragDrop,
    startToTray,
    forceInternalNavigation,
    internalUrlRegex,
    zoom,
    minWidth,
    minHeight,
    ignoreCertificateErrors,
    newWindow,
    camera,
    microphone,
  } = options;

  const platform = asSupportedPlatform(process.platform);
  const platformHideOnClose = hideOnClose ?? platform === 'darwin';

  const tauriConfWindowOptions: Partial<WindowConfig> = {
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
    incognito,
    title,
    enable_wasm: wasm,
    enable_drag_drop: enableDragDrop,
    start_to_tray: startToTray && showSystemTray,
    force_internal_navigation: forceInternalNavigation,
    internal_url_regex: internalUrlRegex,
    zoom,
    min_width: minWidth,
    min_height: minHeight,
    ignore_certificate_errors: ignoreCertificateErrors,
    new_window: newWindow,
  };
  Object.assign(tauriConf.pake.windows[0], { url, ...tauriConfWindowOptions });

  tauriConf.productName = name;
  tauriConf.identifier = identifier;
  tauriConf.version = appVersion;

  const linuxBinaryName = `pake-${generateLinuxPackageName(name)}`;
  tauriConf.mainBinaryName =
    platform === 'linux'
      ? linuxBinaryName
      : `pake-${generateIdentifierSafeName(name)}`;

  if (platform === 'win32') {
    const windowsBundle = tauriConf.bundle.windows;
    if (!windowsBundle) {
      throw new Error(
        'Windows bundle configuration is missing from tauri.windows.conf.json; cannot build Windows target.',
      );
    }
    windowsBundle.wix.language[0] = installerLanguage;
  }

  await handleLocalFile(url, useLocalFile, tauriConf);

  const platformMap: Record<SupportedPlatform, TauriPlatform> = {
    win32: 'windows',
    linux: 'linux',
    darwin: 'macos',
  };
  const currentPlatform = platformMap[platform];

  if (userAgent.length > 0) {
    tauriConf.pake.user_agent[currentPlatform] = userAgent;
  }
  tauriConf.pake.system_tray[currentPlatform] = showSystemTray;

  if (platform === 'linux') {
    await mergeLinuxConfig(options, name, tauriConf, linuxBinaryName);
  }

  if (platform === 'darwin') {
    const validMacTargets = ['app', 'dmg'];
    if (validMacTargets.includes(options.targets)) {
      tauriConf.bundle.targets = [options.targets];
    }
  }

  const safeAppName = getSafeAppName(name);
  await mergeIcons(options, name, tauriConf, platform, safeAppName);

  await injectCustomCode(options, tauriConf);

  if (platform === 'darwin') {
    await generateMacEntitlements(camera, microphone);
  }

  await writeAllConfigs(tauriConf, platform);
}
