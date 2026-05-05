import path from 'path';
import fsExtra from 'fs-extra';

import { CN_MIRROR_ENV } from '@/utils/mirror';
import { IS_MAC } from '@/utils/platform';
import { npmDirectory } from '@/utils/dir';
import logger from '@/options/logger';

/**
 * Returns build environment variables overrides for macOS, where Rust crates
 * sometimes need explicit C/C++ flags and a deterministic SDK target. Other
 * platforms inherit `process.env` unchanged.
 */
export function getBuildEnvironment(): Record<string, string> | undefined {
  if (!IS_MAC) {
    return undefined;
  }

  const currentPath = process.env.PATH || '';
  const systemToolsPath = '/usr/bin';
  const buildPath = currentPath.startsWith(`${systemToolsPath}:`)
    ? currentPath
    : `${systemToolsPath}:${currentPath}`;

  return {
    CFLAGS: '-fno-modules',
    CXXFLAGS: '-fno-modules',
    MACOSX_DEPLOYMENT_TARGET: '14.0',
    PATH: buildPath,
  };
}

/**
 * Windows needs more time due to native compilation and antivirus scanning.
 */
export function getInstallTimeout(): number {
  return process.platform === 'win32' ? 900_000 : 600_000;
}

export function getBuildTimeout(): number {
  return 900_000;
}

let packageManagerCache: 'pnpm' | 'npm' | null = null;

/** Resets the cached package manager. Exported for tests. */
export function _resetPackageManagerCache(): void {
  packageManagerCache = null;
}

/**
 * Returns 'pnpm' when available, otherwise 'npm'. Throws if neither is found.
 * Cached after the first successful detection so tests can call repeatedly.
 */
export async function detectPackageManager(): Promise<'pnpm' | 'npm'> {
  if (packageManagerCache) {
    return packageManagerCache;
  }

  const { execa } = await import('execa');
  try {
    await execa('pnpm', ['--version'], { stdio: 'ignore' });
    logger.info('✺ Using pnpm for package management.');
    packageManagerCache = 'pnpm';
    return 'pnpm';
  } catch {
    try {
      await execa('npm', ['--version'], { stdio: 'ignore' });
      logger.info('✺ pnpm not available, using npm for package management.');
      packageManagerCache = 'npm';
      return 'npm';
    } catch {
      throw new Error(
        'Neither pnpm nor npm is available. Please install a package manager.',
      );
    }
  }
}

export function getInstallCommand(
  packageManager: string,
  useCnMirror: boolean,
): string {
  const registryOption = useCnMirror
    ? ' --registry=https://registry.npmmirror.com'
    : '';
  const peerDepsOption = packageManager === 'npm' ? ' --legacy-peer-deps' : '';
  return `cd "${npmDirectory}" && ${packageManager} install${registryOption}${peerDepsOption}`;
}

async function copyFileWithSamePathGuard(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  if (path.resolve(sourcePath) === path.resolve(destinationPath)) {
    return;
  }
  try {
    await fsExtra.copy(sourcePath, destinationPath, { overwrite: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Source and destination must not be the same')
    ) {
      return;
    }
    throw error;
  }
}

function isGeneratedCnMirrorConfig(
  projectConfig: string,
  cnMirrorConfig: string,
): boolean {
  return projectConfig.trim() === cnMirrorConfig.trim();
}

/**
 * Toggles `.cargo/config.toml` to point at rsproxy.cn when the user opts in
 * via `PAKE_USE_CN_MIRROR=1`, and removes the auto-generated mirror config
 * (or warns about a manual one) when they opt out.
 */
export async function configureCargoRegistry(
  tauriSrcPath: string,
  useCnMirror: boolean,
): Promise<void> {
  const rustProjectDir = path.join(tauriSrcPath, '.cargo');
  const projectConf = path.join(rustProjectDir, 'config.toml');
  const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');

  if (useCnMirror) {
    await fsExtra.ensureDir(rustProjectDir);
    await copyFileWithSamePathGuard(projectCnConf, projectConf);
    return;
  }

  if (!(await fsExtra.pathExists(projectConf))) {
    return;
  }

  const [projectConfig, cnMirrorConfig] = await Promise.all([
    fsExtra.readFile(projectConf, 'utf8'),
    fsExtra.readFile(projectCnConf, 'utf8'),
  ]);

  if (isGeneratedCnMirrorConfig(projectConfig, cnMirrorConfig)) {
    await fsExtra.remove(projectConf);
    return;
  }

  if (projectConfig.includes('rsproxy.cn')) {
    logger.warn(
      `✼ ${projectConf} still references rsproxy.cn. Remove it or set ${CN_MIRROR_ENV}=1 if you want to use the CN mirror.`,
    );
  }
}

/**
 * Returns true when an error string looks like the well-known Tauri+linuxdeploy
 * strip failure that we automatically retry with NO_STRIP=1.
 */
export function isLinuxDeployStripError(error: unknown): boolean {
  if (!(error instanceof Error) || !error.message) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('linuxdeploy') ||
    message.includes('failed to run linuxdeploy') ||
    message.includes('strip:') ||
    message.includes('unable to recognise the format of the input file') ||
    message.includes('appimage tool failed') ||
    message.includes('strip tool')
  );
}
