import path from 'path';
import fsExtra from 'fs-extra';

import { CN_MIRROR_ENV } from '@/utils/mirror';
import { IS_MAC } from '@/utils/platform';
import logger from '@/options/logger';
import type { ShellCommand } from '@/utils/shell';
import packageJson from '../../package.json';

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
 * Build scripts and proc-macros compile for the rustup *host* toolchain, not
 * the `--target` triple, even when cross-compiling. Pake's own
 * rust-toolchain.toml pins a bare channel (no host), which rustup resolves
 * against the machine's configured default host, msvc on most Windows
 * installs, regardless of whether MSVC is actually present. Without this,
 * a gnu `--target` build still shells out to the (possibly missing) MSVC
 * `link.exe` for every build script. RUSTUP_TOOLCHAIN is rustup's documented
 * per-invocation override (read by the cargo/rustc proxies it installs) and
 * only affects this build subprocess. Left alone if the user already set it.
 */
export function getWindowsGnuBuildEnvironment(): Record<string, string> {
  const excludeAllSymbols = ['-C', 'link-args=-Wl,--exclude-all-symbols'];
  const existingRustflags = process.env.RUSTFLAGS;
  const existingEncodedRustflags = process.env.CARGO_ENCODED_RUSTFLAGS;
  // Cargo prefers encoded flags over RUSTFLAGS, even when set to an empty value.
  const flags: Record<string, string> =
    existingEncodedRustflags !== undefined
      ? {
          CARGO_ENCODED_RUSTFLAGS: [
            ...(existingEncodedRustflags ? [existingEncodedRustflags] : []),
            ...excludeAllSymbols,
          ].join('\x1f'),
        }
      : {
          RUSTFLAGS: [
            ...(existingRustflags ? [existingRustflags] : []),
            ...excludeAllSymbols,
          ].join(' '),
        };
  return {
    ...flags,
    RUSTUP_TOOLCHAIN:
      process.env.RUSTUP_TOOLCHAIN || 'stable-x86_64-pc-windows-gnu',
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

function parseMajorVersion(version: string): number | null {
  const match = version.match(/^v?(\d+)/);
  return match ? Number(match[1]) : null;
}

function getPinnedPnpmMajorVersion(): number | null {
  const packageManager = packageJson.packageManager;
  const match = packageManager?.match(/^pnpm@(\d+)/);
  return match ? Number(match[1]) : null;
}

async function detectNpm(
  execa: typeof import('execa').execa,
): Promise<boolean> {
  try {
    await execa('npm', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

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
  let pnpmVersion: string;

  try {
    const { stdout } = await execa('pnpm', ['--version']);
    pnpmVersion = stdout.trim();
  } catch {
    if (await detectNpm(execa)) {
      logger.info('✺ pnpm not available, using npm for package management.');
      packageManagerCache = 'npm';
      return 'npm';
    }

    throw new Error(
      'Neither pnpm nor npm is available. Please install a package manager.',
    );
  }

  const normalizedPnpmVersion = pnpmVersion.startsWith('v')
    ? pnpmVersion
    : `v${pnpmVersion}`;
  const pnpmMajor = parseMajorVersion(pnpmVersion);
  const pinnedPnpmMajor = getPinnedPnpmMajorVersion();

  if (
    pnpmMajor !== null &&
    pinnedPnpmMajor !== null &&
    pnpmMajor !== pinnedPnpmMajor
  ) {
    if (!(await detectNpm(execa))) {
      throw new Error(
        `Detected pnpm ${normalizedPnpmVersion}, but Pake is pinned to ${packageJson.packageManager}. Install npm so Pake can fall back, or use pnpm ${pinnedPnpmMajor}.x to match the project pin.`,
      );
    }

    logger.warn(
      `✼ Detected pnpm ${normalizedPnpmVersion}, but Pake is pinned to ${packageJson.packageManager}; using npm for package management instead.`,
    );
    packageManagerCache = 'npm';
    return 'npm';
  }

  logger.info('✺ Using pnpm for package management.');
  packageManagerCache = 'pnpm';
  return 'pnpm';
}

export function getInstallCommand(
  packageManager: string,
  useCnMirror: boolean,
): ShellCommand {
  const args = ['install'];
  if (useCnMirror) args.push('--registry=https://registry.npmmirror.com');
  if (packageManager === 'npm') args.push('--legacy-peer-deps');
  return { executable: packageManager, args };
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
