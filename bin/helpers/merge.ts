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
import { PakeError } from '@/utils/error';
import { LINUX_TARGET_TYPES, resolveLinuxBundleTargets } from '@/utils/targets';

/**
 * Pure transform from CLI options to the window-config slice that gets
 * merged into pake.json. Exposed for snapshot testing so option drift
 * (e.g. a new flag added in cli-program.ts but forgotten here) is caught.
 *
 * Keep this function side-effect free.
 */
export function buildWindowConfigOverrides(
  options: PakeAppOptions,
  platform: SupportedPlatform = asSupportedPlatform(process.platform),
): Partial<WindowConfig> {
  const platformHideOnClose = options.hideOnClose ?? platform === 'darwin';
  const platformHideTitleBar =
    platform === 'darwin' ? options.hideTitleBar : false;
  const platformHideWindowDecorations =
    platform !== 'darwin' ? options.hideWindowDecorations : false;
  return {
    width: options.width,
    height: options.height,
    fullscreen: options.fullscreen,
    maximize: options.maximize,
    resizable: options.resizable ?? true,
    hide_title_bar: platformHideTitleBar,
    hide_window_decorations: platformHideWindowDecorations,
    activation_shortcut: options.activationShortcut,
    always_on_top: options.alwaysOnTop,
    dark_mode: options.darkMode,
    disabled_web_shortcuts: options.disabledWebShortcuts,
    hide_on_close: platformHideOnClose,
    incognito: options.incognito,
    title: options.title,
    enable_wasm: options.wasm,
    enable_drag_drop: options.enableDragDrop,
    start_to_tray: options.startToTray && options.showSystemTray,
    force_internal_navigation: options.forceInternalNavigation,
    internal_url_regex: options.internalUrlRegex,
    enable_find: options.enableFind,
    zoom: options.zoom,
    min_width: options.minWidth,
    min_height: options.minHeight,
    ignore_certificate_errors: options.ignoreCertificateErrors,
    new_window: options.newWindow,
  };
}

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

// Replace the CLI's own dist/ with the user's static files while keeping the
// build artifacts (cli.js) the packaged app does not need but the CLI does.
// dist_bak always holds the ORIGINAL package dist: once it exists, later
// stagings must not overwrite it with a previous user tree, or the original
// files would be unrecoverable across repeated local builds.
async function stageLocalTree(sourceDir: string): Promise<void> {
  const distDir = path.join(npmDirectory, 'dist');
  const distBakDir = path.join(npmDirectory, 'dist_bak');

  // Resolve symlinked input up front: staging must produce a real copy, or
  // the cli.js copy-back below would write through the link into the user's
  // own directory.
  const resolvedSource = await fsExtra.realpath(sourceDir);
  const resolvedPackage = await fsExtra
    .realpath(npmDirectory)
    .catch(() => path.resolve(npmDirectory));
  const packageDist = path.join(resolvedPackage, 'dist');
  if (
    resolvedSource === resolvedPackage ||
    resolvedPackage.startsWith(resolvedSource + path.sep) ||
    resolvedSource === packageDist ||
    resolvedSource.startsWith(packageDist + path.sep)
  ) {
    throw new PakeError(
      `Local input "${sourceDir}" contains the Pake CLI installation itself.`,
      {
        code: 'INVALID_INPUT',
        hint: 'Point Pake at your built output directory, not at a directory containing pake-cli.',
      },
    );
  }

  try {
    if (await fsExtra.pathExists(distBakDir)) {
      fsExtra.removeSync(distDir);
    } else {
      fsExtra.moveSync(distDir, distBakDir);
    }
    fsExtra.copySync(resolvedSource, distDir, {
      overwrite: true,
      dereference: true,
    });

    const filesToCopyBack = ['cli.js'];
    await Promise.all(
      filesToCopyBack.map((file) =>
        fsExtra.copy(path.join(distBakDir, file), path.join(distDir, file)),
      ),
    );
  } catch (error) {
    // Never leave the package without its own dist/: cli.js lives there and
    // every later `pake` invocation would fail until a manual reinstall.
    restoreLocalTree();
    throw error;
  }
}

// Put the package's original dist/ back once a local-input run is over (or
// failed). Tauri bakes `frontendDist: ../dist` into every binary, so a stale
// staged tree would leak this user's files into the next app built from the
// same install. Safe to call on any run: a present dist_bak always holds the
// original package dist, including one stranded by an older crashed run.
export function restoreLocalTree(): void {
  const distDir = path.join(npmDirectory, 'dist');
  const distBakDir = path.join(npmDirectory, 'dist_bak');
  if (!fsExtra.pathExistsSync(distBakDir)) {
    return;
  }
  try {
    fsExtra.removeSync(distDir);
    fsExtra.moveSync(distBakDir, distDir);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Failed to restore the CLI's original dist/ from dist_bak: ${detail}`,
    );
  }
}

// Exported for unit tests (web fallback and directory entry guard).
export async function handleLocalFile(
  url: string,
  useLocalFile: boolean,
  tauriConf: PakeTauriConfig,
): Promise<void> {
  const pathExists = await fsExtra.pathExists(url);
  if (!pathExists) {
    tauriConf.pake.windows[0].url_type = 'web';
    return;
  }

  const stat = await fsExtra.stat(url);

  if (stat.isDirectory()) {
    // A directory of static web assets (e.g. a generated dist/): the whole
    // tree is packaged and the app entry is its root index.html.
    const entryFile = 'index.html';
    if (!(await fsExtra.pathExists(path.join(url, entryFile)))) {
      throw new PakeError(
        `Local directory "${url}" has no ${entryFile} at its root.`,
        {
          code: 'INVALID_INPUT',
          hint: 'Point Pake at the built output directory that contains index.html.',
        },
      );
    }
    logger.info(`✺ Packaging local directory: ${url}`);
    await stageLocalTree(url);
    tauriConf.pake.windows[0].url = entryFile;
    tauriConf.pake.windows[0].url_type = 'local';
    return;
  }

  logger.info(`✺ Packaging local file: ${url}`);

  const fileName = path.basename(url);
  const distDir = path.join(npmDirectory, 'dist');

  if (!useLocalFile) {
    const urlPath = path.join(distDir, fileName);
    await fsExtra.copy(url, urlPath);
  } else {
    await stageLocalTree(path.dirname(url));
  }

  tauriConf.pake.windows[0].url = fileName;
  tauriConf.pake.windows[0].url_type = 'local';
}

export function buildLinuxDesktopContent(
  name: string,
  title: string | undefined,
  linuxBinaryName: string,
): string {
  const chineseName = title && /[\u4e00-\u9fa5]/.test(title) ? title : null;

  return `[Desktop Entry]
Version=1.0
Type=Application
Name=${name}
${chineseName ? `Name[zh_CN]=${chineseName}` : ''}
Comment=${name}
Exec=${linuxBinaryName}
Icon=${linuxBinaryName}
Categories=Network;WebBrowser;Utility;
MimeType=text/html;text/xml;application/xhtml_xml;
StartupNotify=true
Terminal=false
`;
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
  const desktopContent = buildLinuxDesktopContent(
    name,
    options.title,
    linuxBinaryName,
  );

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

  // options.targets reaches here already stripped of any -arm64 suffix by the
  // LinuxBuilder constructor, and may carry several comma-separated formats
  // (e.g. the distro-aware default "deb,appimage"). Validate the parsed list
  // rather than string-matching the whole value, so a valid multi-target
  // default no longer trips the "must be one of ..." warning on every build.
  const { bundleTargets, hasValidTarget } = resolveLinuxBundleTargets(
    options.targets,
  );

  if (hasValidTarget) {
    tauriConf.bundle.targets = bundleTargets;
  } else {
    logger.warn(
      `✼ The target must be one of ${LINUX_TARGET_TYPES.join(', ')}, the default 'deb' will be used.`,
    );
  }
}

export async function resolveSystemTrayIconPath(
  systemTrayIcon: string,
  defaultTrayIconPath: string,
  safeAppName: string,
  iconOutputDir = path.join(npmDirectory, 'src-tauri/png'),
): Promise<string> {
  if (systemTrayIcon.length === 0) {
    return defaultTrayIconPath;
  }

  try {
    const iconExt = path.extname(systemTrayIcon).toLowerCase();
    if (iconExt !== '.png' && iconExt !== '.ico') {
      logger.warn(
        `✼ System tray icon must be .ico or .png, but you provided ${iconExt}.`,
      );
      logger.warn(`✼ Default system tray icon will be used.`);
      return defaultTrayIconPath;
    }

    if (!(await fsExtra.pathExists(systemTrayIcon))) {
      logger.warn(`✼ System tray icon "${systemTrayIcon}" was not found.`);
      logger.warn(`✼ Default system tray icon will be used.`);
      return defaultTrayIconPath;
    }

    const trayIconPath = `png/${safeAppName}${iconExt}`;
    const trayIcoPath = path.join(iconOutputDir, `${safeAppName}${iconExt}`);
    await fsExtra.copy(systemTrayIcon, trayIcoPath);
    return trayIconPath;
  } catch (err) {
    logger.warn(
      `✼ Failed to apply system tray icon "${systemTrayIcon}": ${err instanceof Error ? err.message : String(err)}`,
    );
    logger.warn(`✼ Default system tray icon will remain unchanged.`);
    return defaultTrayIconPath;
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
  const defaultTrayIconPath =
    platform === 'darwin' ? 'png/icon_512.png' : tauriConf.bundle.icon![0];
  const trayIconPath = await resolveSystemTrayIconPath(
    options.systemTrayIcon,
    defaultTrayIconPath,
    safeAppName,
  );

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
    appVersion,
    userAgent,
    showSystemTray,
    useLocalFile,
    identifier,
    name = 'pake-app',
    installerLanguage,
    wasm,
    camera,
    microphone,
  } = options;

  const platform = asSupportedPlatform(process.platform);
  if (options.hideTitleBar && platform !== 'darwin') {
    logger.warn(
      '✼ --hide-title-bar is only supported on macOS and will be ignored on this platform.',
    );
  }
  if (options.hideWindowDecorations && platform === 'darwin') {
    logger.warn(
      '✼ --hide-window-decorations is only supported on Windows and Linux and will be ignored on this platform.',
    );
  }
  const tauriConfWindowOptions = buildWindowConfigOverrides(options, platform);
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
