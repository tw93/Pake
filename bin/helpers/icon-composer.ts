import path from 'path';
import fsExtra from 'fs-extra';
import { execa, type ExecaError } from 'execa';
import { dir } from 'tmp-promise';

import logger from '@/options/logger';

const ACTOOL_VERSION_ARGS = [
  '--version',
  '--output-format=human-readable-text',
];

const ACTOOL_TIMEOUT_MS = {
  version: 20_000,
  compile: 120_000,
} as const;

export function iconPathExtension(iconPath: string): string {
  return path.extname(iconPath.replace(/[/\\]+$/, '')).toLowerCase();
}

export function isIconComposerUrl(iconUrl: string): boolean {
  try {
    const pathname = new URL(iconUrl).pathname
      .replace(/\/+$/, '')
      .toLowerCase();
    return pathname.endsWith('.icon');
  } catch {
    return iconUrl.replace(/\/+$/, '').toLowerCase().endsWith('.icon');
  }
}

export async function isMacOSIconComposerPackage(
  iconPath: string,
): Promise<boolean> {
  try {
    const stat = await fsExtra.stat(iconPath);
    if (!stat.isDirectory()) {
      return false;
    }
    return await fsExtra.pathExists(path.join(iconPath, 'icon.json'));
  } catch {
    return false;
  }
}

/** Parse `actool --version --output-format=human-readable-text`, matching Tauri. */
export function parseActoolVersion(output: string): string | null {
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('short-bundle-version:')) {
      const version = line.slice('short-bundle-version:'.length).trim();
      return version || null;
    }
  }
  return null;
}

export function actoolMajorVersion(version: string): number | null {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isFinite(major) ? major : null;
}

function isCommandMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const execaError = error as Partial<ExecaError>;
  return (
    execaError.code === 'ENOENT' ||
    execaError.exitCode === 127 ||
    (typeof execaError.stderr === 'string' &&
      /not found|No such file/i.test(execaError.stderr))
  );
}

async function runActool(args: string[], timeout: number) {
  const options = { stdin: 'ignore' as const, reject: false, timeout };
  const attempts: Array<{ file: string; argv: string[] }> = [
    { file: 'xcrun', argv: ['actool', ...args] },
    { file: 'actool', argv: args },
  ];

  for (const attempt of attempts) {
    try {
      const result = await execa(attempt.file, attempt.argv, options);
      if (isCommandMissing(result)) {
        continue;
      }
      return result;
    } catch (error) {
      if (isCommandMissing(error)) {
        continue;
      }
      throw error;
    }
  }
  return null;
}

export async function getActoolMajorVersion(): Promise<number | null> {
  const result = await runActool(
    ACTOOL_VERSION_ARGS,
    ACTOOL_TIMEOUT_MS.version,
  );
  if (!result) {
    return null;
  }
  const version = parseActoolVersion(`${result.stdout}\n${result.stderr}`);
  return version ? actoolMajorVersion(version) : null;
}

export async function warnIfActoolUnavailable(): Promise<number | null> {
  const major = await getActoolMajorVersion();
  if (major === null) {
    logger.warn(
      '✼ Could not find actool (needs Xcode 26+). Liquid Glass icons will not be compiled; the .icns fallback will be used.',
    );
    return null;
  }
  if (major < 26) {
    logger.warn(
      `✼ actool ${major} is too old for Icon Composer .icon packages (need 26+ / Xcode 26). The .icns fallback will be used.`,
    );
  }
  return major;
}

async function compileAssetsCar(
  iconPackagePath: string,
  destPath: string,
): Promise<boolean> {
  const { path: tempRoot, cleanup } = await dir({ unsafeCleanup: true });
  try {
    const iconDest = path.join(tempRoot, 'Icon.icon');
    const outputPath = path.join(tempRoot, 'out');
    await fsExtra.copy(iconPackagePath, iconDest);
    await fsExtra.ensureDir(outputPath);

    // Flags match tauri-bundler 2.12.4 (crates/tauri-bundler/src/bundle/macos/icon.rs).
    // stdin is closed so we do not inherit Node's fd 0 (tauri-apps/tauri#15315, #15991).
    const args = [
      iconDest,
      '--compile',
      outputPath,
      '--output-format',
      'human-readable-text',
      '--notices',
      '--warnings',
      '--output-partial-info-plist',
      path.join(outputPath, 'assetcatalog_generated_info.plist'),
      '--app-icon',
      'Icon',
      '--include-all-app-icons',
      '--accent-color',
      'AccentColor',
      '--enable-on-demand-resources',
      'NO',
      '--development-region',
      'en',
      '--target-device',
      'mac',
      '--minimum-deployment-target',
      '26.0',
      '--platform',
      'macosx',
    ];

    await runActool(args, ACTOOL_TIMEOUT_MS.compile);

    const assetsCar = path.join(outputPath, 'Assets.car');
    if (!(await fsExtra.pathExists(assetsCar))) {
      return false;
    }
    // Copy out before the temp directory is removed in `finally`.
    await fsExtra.ensureDir(path.dirname(destPath));
    await fsExtra.copy(assetsCar, destPath);
    return true;
  } finally {
    await cleanup();
  }
}

/**
 * Precompile an Icon Composer package to Assets.car so Tauri's bundler
 * does not have to spawn actool itself (a known hang/crash on Xcode 27).
 * Returns the destination path of Assets.car, or null if compilation failed.
 */
export async function precompileIconComposerAssets(
  iconPackagePath: string,
  destIconsDir: string,
): Promise<string | null> {
  const major = await getActoolMajorVersion();
  if (major === null || major < 26) {
    return null;
  }

  await fsExtra.ensureDir(destIconsDir);
  const dest = path.join(destIconsDir, 'Assets.car');

  if (await compileAssetsCar(iconPackagePath, dest)) {
    return dest;
  }

  logger.warn(
    '✼ actool could not compile the .icon package (tauri-apps/tauri#15315, #16386). The app will use the .icns icon instead.',
  );
  return null;
}

export type DarwinIconComposerResult = {
  bundleIcon: string[];
};

/**
 * Copy a valid .icon package (and an .icns fallback) into src-tauri/icons
 * and return the paths to set on tauriConf.bundle.icon.
 */
export async function applyDarwinIconComposerPackage(options: {
  sourceIconPath: string;
  destIconsDir: string;
  safeAppName: string;
  defaultIcnsPath: string;
}): Promise<DarwinIconComposerResult> {
  const { sourceIconPath, destIconsDir, safeAppName, defaultIcnsPath } =
    options;
  await fsExtra.ensureDir(destIconsDir);

  const destIconPackage = path.join(destIconsDir, `${safeAppName}.icon`);
  if (path.resolve(sourceIconPath) !== path.resolve(destIconPackage)) {
    await fsExtra.copy(sourceIconPath, destIconPackage);
  }

  const normalizedSource = sourceIconPath.replace(/[/\\]+$/, '');
  const siblingIcns = path.join(
    path.dirname(normalizedSource),
    `${path.parse(normalizedSource).name}.icns`,
  );
  const destIcns = path.join(destIconsDir, `${safeAppName}.icns`);

  let fallbackSource: string | null = null;
  if (await fsExtra.pathExists(siblingIcns)) {
    const stat = await fsExtra.stat(siblingIcns);
    if (stat.isFile()) {
      fallbackSource = siblingIcns;
    }
  }
  if (!fallbackSource && (await fsExtra.pathExists(defaultIcnsPath))) {
    fallbackSource = defaultIcnsPath;
  }

  let hasIcns = false;
  if (fallbackSource) {
    if (path.resolve(fallbackSource) !== path.resolve(destIcns)) {
      await fsExtra.copy(fallbackSource, destIcns);
    }
    hasIcns = await fsExtra.pathExists(destIcns);
  }
  if (!hasIcns) {
    logger.warn(
      '✼ No .icns fallback found next to the .icon package, and Pake default icon.icns is missing. Older macOS will not have a static icon.',
    );
  }

  await warnIfActoolUnavailable();
  const compiledCar = await precompileIconComposerAssets(
    destIconPackage,
    destIconsDir,
  );

  // Tauri runs actool itself for a .icon in bundle.icon and fails the whole
  // build when actool errors, so only a precompiled Assets.car goes in; when
  // that could not be built, the app ships with the .icns alone.
  const bundleIcon: string[] = [];
  if (compiledCar) {
    logger.info('✼ Precompiled Assets.car from the Icon Composer package.');
    bundleIcon.push('icons/Assets.car');
  }
  if (hasIcns) {
    bundleIcon.push(`icons/${safeAppName}.icns`);
  }
  if (bundleIcon.length === 0) {
    bundleIcon.push(`icons/${safeAppName}.icon`);
  }
  return { bundleIcon };
}
