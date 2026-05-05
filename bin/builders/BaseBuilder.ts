import path from 'path';
import fsExtra from 'fs-extra';
import chalk from 'chalk';
import prompts from 'prompts';

import { PakeAppOptions } from '@/types';
import { checkRustInstalled, ensureRustEnv, installRust } from '@/helpers/rust';
import { mergeConfig } from '@/helpers/merge';
import tauriConfig from '@/helpers/tauriConfig';
import {
  generateIdentifierSafeName,
  generateLinuxPackageName,
} from '@/utils/name';
import { npmDirectory } from '@/utils/dir';
import { getSpinner } from '@/utils/info';
import { shellExec } from '@/utils/shell';
import { CN_MIRROR_ENV, isCnMirrorEnabled } from '@/utils/mirror';
import { IS_MAC } from '@/utils/platform';
import logger from '@/options/logger';
import {
  configureCargoRegistry,
  detectPackageManager,
  getBuildEnvironment,
  getBuildTimeout,
  getInstallCommand,
  getInstallTimeout,
  isLinuxDeployStripError,
} from './env';

export default abstract class BaseBuilder {
  protected options: PakeAppOptions;

  protected constructor(options: PakeAppOptions) {
    this.options = options;
  }

  async prepare() {
    const tauriSrcPath = path.join(npmDirectory, 'src-tauri');
    const tauriTargetPath = path.join(tauriSrcPath, 'target');
    const tauriTargetPathExists = await fsExtra.pathExists(tauriTargetPath);

    if (!IS_MAC && !tauriTargetPathExists) {
      logger.warn('✼ The first use requires installing system dependencies.');
      logger.warn('✼ See more in https://tauri.app/start/prerequisites/.');
    }

    ensureRustEnv();

    if (!checkRustInstalled()) {
      const res = await prompts({
        type: 'confirm',
        message: 'Rust not detected. Install now?',
        name: 'value',
      });

      if (res.value) {
        await installRust();
      } else {
        logger.error('✕ Rust required to package your webapp.');
        process.exit(1);
      }
    }

    const spinner = getSpinner('Installing package...');
    const useCnMirror = isCnMirrorEnabled();
    await configureCargoRegistry(tauriSrcPath, useCnMirror);

    const packageManager = await detectPackageManager();
    const timeout = getInstallTimeout();
    const buildEnv = getBuildEnvironment();

    // Show helpful message for first-time users
    if (!tauriTargetPathExists) {
      logger.info(
        process.platform === 'win32'
          ? '✺ First-time setup may take 10-15 minutes on Windows (compiling dependencies)...'
          : '✺ First-time setup may take 5-10 minutes (installing dependencies)...',
      );
    }

    if (useCnMirror) {
      logger.info(
        `✺ ${CN_MIRROR_ENV}=1 detected, using ${packageManager}/rsProxy CN mirror.`,
      );
    }

    try {
      await shellExec(getInstallCommand(packageManager, useCnMirror), timeout, {
        ...buildEnv,
        CI: 'true',
      });
      spinner.succeed(chalk.green('Package installed!'));
    } catch (error) {
      spinner.fail(chalk.red('Installation failed'));
      if (!useCnMirror) {
        logger.info(
          `✺ If downloads are slow in China, retry with ${CN_MIRROR_ENV}=1 to use CN mirrors.`,
        );
      }
      throw error;
    }

    if (!tauriTargetPathExists) {
      logger.warn(
        '✼ The first packaging may be slow, please be patient and wait, it will be faster afterwards.',
      );
    }
  }

  async build(url: string) {
    await this.buildAndCopy(url, this.options.targets);
  }

  async start(url: string) {
    logger.info('Pake dev server starting...');
    await mergeConfig(url, this.options, tauriConfig);

    const packageManager = await detectPackageManager();
    const configPath = path.join(
      npmDirectory,
      'src-tauri',
      '.pake',
      'tauri.conf.json',
    );

    const features = this.getBuildFeatures();
    const featureArgs =
      features.length > 0 ? `--features ${features.join(',')}` : '';

    const argSeparator = packageManager === 'npm' ? ' --' : '';
    const command = `cd "${npmDirectory}" && ${packageManager} run tauri${argSeparator} dev --config "${configPath}" ${featureArgs}`;

    await shellExec(command);
  }

  async buildAndCopy(url: string, target: string) {
    const { name = 'pake-app' } = this.options;
    await mergeConfig(url, this.options, tauriConfig);

    const packageManager = await detectPackageManager();

    // Build app
    const buildSpinner = getSpinner('Building app...');
    // Let spinner run for a moment so user can see it, then stop before package manager command
    await new Promise((resolve) => setTimeout(resolve, 500));
    buildSpinner.stop();
    // Show static message to keep the status visible
    logger.warn('✸ Building app...');

    const baseEnv = getBuildEnvironment();
    let buildEnv: Record<string, string> = {
      ...(baseEnv ?? {}),
      ...(process.env.NO_STRIP ? { NO_STRIP: process.env.NO_STRIP } : {}),
    };

    const resolveExecEnv = () =>
      Object.keys(buildEnv).length > 0 ? buildEnv : undefined;

    // Warn users about potential AppImage build failures on modern Linux systems.
    // The linuxdeploy tool bundled in Tauri uses an older strip tool that doesn't
    // recognize the .relr.dyn section introduced in glibc 2.38+.
    if (process.platform === 'linux' && target === 'appimage') {
      if (!buildEnv.NO_STRIP) {
        logger.warn(
          '⚠ Building AppImage on Linux may fail due to strip incompatibility with glibc 2.38+',
        );
        logger.warn(
          '⚠ If build fails, retry with: NO_STRIP=1 pake <url> --targets appimage',
        );
      }
    }

    const buildCommand = `cd "${npmDirectory}" && ${this.getBuildCommand(packageManager)}`;
    const buildTimeout = getBuildTimeout();

    try {
      await shellExec(buildCommand, buildTimeout, resolveExecEnv());
    } catch (error) {
      const shouldRetryWithoutStrip =
        process.platform === 'linux' &&
        target === 'appimage' &&
        !buildEnv.NO_STRIP &&
        isLinuxDeployStripError(error);

      if (shouldRetryWithoutStrip) {
        logger.warn(
          '⚠ AppImage build failed during linuxdeploy strip step, retrying with NO_STRIP=1 automatically.',
        );
        buildEnv = {
          ...buildEnv,
          NO_STRIP: '1',
        };
        await shellExec(buildCommand, buildTimeout, resolveExecEnv());
      } else {
        throw error;
      }
    }

    // Copy app
    const fileName = this.getFileName();
    const fileType = this.getFileType(target);
    const appPath = this.getBuildAppPath(npmDirectory, fileName, fileType);
    const distPath = path.resolve(`${name}.${fileType}`);
    await fsExtra.copy(appPath, distPath);

    // Copy raw binary if requested
    if (this.options.keepBinary) {
      await this.copyRawBinary(npmDirectory, name);
    }

    await fsExtra.remove(appPath);
    logger.success('✔ Build success!');
    logger.success('✔ App installer located in', distPath);

    // Log binary location if preserved
    if (this.options.keepBinary) {
      const binaryPath = this.getRawBinaryPath(name);
      logger.success('✔ Raw binary located in', path.resolve(binaryPath));
    }

    if (IS_MAC && fileType === 'app' && this.options.install) {
      await this.installAppToApplications(distPath, name);
    }
  }

  private async installAppToApplications(
    appBundlePath: string,
    appName: string,
  ): Promise<void> {
    try {
      logger.info(`- Installing ${appName} to /Applications...`);

      const appBundleName = path.basename(appBundlePath);
      const appDest = path.join('/Applications', appBundleName);

      if (await fsExtra.pathExists(appDest)) {
        logger.warn(
          `  Existing ${appBundleName} in /Applications will be replaced.`,
        );
      }

      // fsExtra.move uses fs.rename (atomic on same filesystem) and falls back
      // to copy+remove only when moving across volumes.
      await fsExtra.move(appBundlePath, appDest, { overwrite: true });

      logger.success(
        `✔ ${appBundleName.replace(/\.app$/, '')} installed to /Applications`,
      );
    } catch (error) {
      logger.error(`✕ Failed to install ${appName}: ${error}`);
      logger.info(`  App bundle still available at: ${appBundlePath}`);
    }
  }

  protected getFileType(target: string): string {
    return target;
  }

  abstract getFileName(): string;

  protected static readonly ARCH_MAPPINGS: Record<
    string,
    Record<string, string>
  > = {
    darwin: {
      arm64: 'aarch64-apple-darwin',
      x64: 'x86_64-apple-darwin',
      universal: 'universal-apple-darwin',
    },
    win32: {
      arm64: 'aarch64-pc-windows-msvc',
      x64: 'x86_64-pc-windows-msvc',
    },
    linux: {
      arm64: 'aarch64-unknown-linux-gnu',
      x64: 'x86_64-unknown-linux-gnu',
    },
  };

  protected static readonly ARCH_DISPLAY_NAMES: Record<string, string> = {
    arm64: 'aarch64',
    x64: 'x64',
    universal: 'universal',
  };

  protected resolveTargetArch(requestedArch?: string): string {
    if (requestedArch === 'auto' || !requestedArch) {
      return process.arch;
    }
    return requestedArch;
  }

  protected getTauriTarget(
    arch: string,
    platform: NodeJS.Platform = process.platform,
  ): string | null {
    const platformMappings = BaseBuilder.ARCH_MAPPINGS[platform];
    if (!platformMappings) return null;
    return platformMappings[arch] || null;
  }

  protected getArchDisplayName(arch: string): string {
    return BaseBuilder.ARCH_DISPLAY_NAMES[arch] || arch;
  }

  protected buildBaseCommand(
    packageManager: string,
    configPath: string,
    target?: string,
  ): string {
    const baseCommand = this.options.debug
      ? `${packageManager} run build:debug`
      : `${packageManager} run build`;

    const argSeparator = packageManager === 'npm' ? ' --' : '';
    let fullCommand = `${baseCommand}${argSeparator} -c "${configPath}"`;

    if (target) {
      fullCommand += ` --target ${target}`;
    }

    // Enable verbose output in debug mode to help diagnose build issues.
    // This provides detailed logs from Tauri CLI and bundler tools.
    if (this.options.debug) {
      fullCommand += ' --verbose';
    }

    const features = this.getBuildFeatures();
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
    }

    return fullCommand;
  }

  protected getBuildFeatures(): string[] {
    const features = ['cli-build'];

    // Add macos-proxy feature for modern macOS (Darwin 23+ = macOS 14+)
    if (IS_MAC) {
      const macOSVersion = this.getMacOSMajorVersion();
      if (macOSVersion >= 23) {
        features.push('macos-proxy');
      }
    }

    return features;
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): string {
    // Use temporary config directory to avoid modifying source files
    const configPath = path.join(
      npmDirectory,
      'src-tauri',
      '.pake',
      'tauri.conf.json',
    );

    let fullCommand = this.buildBaseCommand(packageManager, configPath);

    // For macOS, use app bundles by default unless DMG is explicitly requested
    if (IS_MAC && this.options.targets === 'app') {
      fullCommand += ' --bundles app';
    }

    return fullCommand;
  }

  protected getMacOSMajorVersion(): number {
    try {
      const os = require('os');
      const release = os.release();
      const majorVersion = parseInt(release.split('.')[0], 10);
      return majorVersion;
    } catch (error) {
      return 0; // Disable proxy feature if version detection fails
    }
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';
    return `src-tauri/target/${basePath}/bundle/`;
  }

  protected getBuildAppPath(
    npmDirectory: string,
    fileName: string,
    fileType: string,
  ): string {
    // For app bundles on macOS, the directory is 'macos', not 'app'
    const bundleDir =
      fileType.toLowerCase() === 'app' ? 'macos' : fileType.toLowerCase();
    return path.join(
      npmDirectory,
      this.getBasePath(),
      bundleDir,
      `${fileName}.${fileType}`,
    );
  }

  /**
   * Copy raw binary file to output directory
   */
  protected async copyRawBinary(
    npmDirectory: string,
    appName: string,
  ): Promise<void> {
    const binaryPath = this.getRawBinarySourcePath(npmDirectory, appName);
    const outputPath = this.getRawBinaryPath(appName);

    if (await fsExtra.pathExists(binaryPath)) {
      await fsExtra.copy(binaryPath, outputPath);
      // Make binary executable on Unix-like systems
      if (process.platform !== 'win32') {
        await fsExtra.chmod(outputPath, 0o755);
      }
    } else {
      logger.warn(`✼ Raw binary not found at ${binaryPath}, skipping...`);
    }
  }

  /**
   * Get the source path of the raw binary file in the build directory
   */
  protected getRawBinarySourcePath(
    npmDirectory: string,
    appName: string,
  ): string {
    const basePath = this.options.debug ? 'debug' : 'release';
    const binaryName = this.getBinaryName(appName);

    // Handle cross-platform builds
    if (this.options.multiArch || this.hasArchSpecificTarget()) {
      return path.join(
        npmDirectory,
        this.getArchSpecificPath(),
        basePath,
        binaryName,
      );
    }

    return path.join(npmDirectory, 'src-tauri/target', basePath, binaryName);
  }

  /**
   * Get the output path for the raw binary file
   */
  protected getRawBinaryPath(appName: string): string {
    const extension = process.platform === 'win32' ? '.exe' : '';
    const suffix = process.platform === 'win32' ? '' : '-binary';
    return `${appName}${suffix}${extension}`;
  }

  /**
   * Get the binary name based on app name and platform
   */
  protected getBinaryName(appName: string): string {
    const extension = process.platform === 'win32' ? '.exe' : '';

    // Use unique binary name for all platforms to avoid conflicts
    const nameToUse =
      process.platform === 'linux'
        ? generateLinuxPackageName(appName)
        : generateIdentifierSafeName(appName);
    return `pake-${nameToUse}${extension}`;
  }

  /**
   * Check if this build has architecture-specific target
   */
  protected hasArchSpecificTarget(): boolean {
    return false; // Override in subclasses if needed
  }

  /**
   * Get architecture-specific path for binary
   */
  protected getArchSpecificPath(): string {
    return 'src-tauri/target'; // Override in subclasses if needed
  }
}
