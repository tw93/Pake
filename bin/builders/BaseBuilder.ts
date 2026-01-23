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
import { isChinaDomain } from '@/utils/ip';
import { IS_MAC } from '@/utils/platform';
import logger from '@/options/logger';

export default abstract class BaseBuilder {
  protected options: PakeAppOptions;
  private static packageManagerCache: string | null = null;

  protected constructor(options: PakeAppOptions) {
    this.options = options;
  }

  private getBuildEnvironment() {
    return IS_MAC
      ? {
          CFLAGS: '-fno-modules',
          CXXFLAGS: '-fno-modules',
          MACOSX_DEPLOYMENT_TARGET: '14.0',
        }
      : undefined;
  }

  private getInstallTimeout(): number {
    // Windows needs more time due to native compilation and antivirus scanning
    return process.platform === 'win32' ? 900000 : 600000;
  }

  private getBuildTimeout(): number {
    return 900000;
  }

  private async detectPackageManager(): Promise<string> {
    if (BaseBuilder.packageManagerCache) {
      return BaseBuilder.packageManagerCache;
    }

    const { execa } = await import('execa');

    try {
      await execa('pnpm', ['--version'], { stdio: 'ignore' });
      logger.info('✺ Using pnpm for package management.');
      BaseBuilder.packageManagerCache = 'pnpm';
      return 'pnpm';
    } catch {
      try {
        await execa('npm', ['--version'], { stdio: 'ignore' });
        logger.info('✺ pnpm not available, using npm for package management.');
        BaseBuilder.packageManagerCache = 'npm';
        return 'npm';
      } catch {
        throw new Error(
          'Neither pnpm nor npm is available. Please install a package manager.',
        );
      }
    }
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
        process.exit(0);
      }
    }

    const isChina = await isChinaDomain('www.npmjs.com');
    const spinner = getSpinner('Installing package...');
    const rustProjectDir = path.join(tauriSrcPath, '.cargo');
    const projectConf = path.join(rustProjectDir, 'config.toml');
    await fsExtra.ensureDir(rustProjectDir);

    // Detect available package manager
    const packageManager = await this.detectPackageManager();
    const registryOption = ' --registry=https://registry.npmmirror.com';
    const peerDepsOption =
      packageManager === 'npm' ? ' --legacy-peer-deps' : '';

    const timeout = this.getInstallTimeout();
    const buildEnv = this.getBuildEnvironment();

    // Show helpful message for first-time users
    if (!tauriTargetPathExists) {
      logger.info(
        process.platform === 'win32'
          ? '✺ First-time setup may take 10-15 minutes on Windows (compiling dependencies)...'
          : '✺ First-time setup may take 5-10 minutes (installing dependencies)...',
      );
    }

    let usedMirror = isChina;

    try {
      if (isChina) {
        logger.info(
          `✺ Located in China, using ${packageManager}/rsProxy CN mirror.`,
        );
        const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');
        await fsExtra.copy(projectCnConf, projectConf);
        await shellExec(
          `cd "${npmDirectory}" && ${packageManager} install${registryOption}${peerDepsOption}`,
          timeout,
          { ...buildEnv, CI: 'true' },
        );
      } else {
        await shellExec(
          `cd "${npmDirectory}" && ${packageManager} install${peerDepsOption}`,
          timeout,
          { ...buildEnv, CI: 'true' },
        );
      }
      spinner.succeed(chalk.green('Package installed!'));
    } catch (error: unknown) {
      // If installation times out and we haven't tried the mirror yet, retry with mirror
      if (
        error instanceof Error &&
        error.message.includes('timed out') &&
        !usedMirror
      ) {
        spinner.fail(
          chalk.yellow('Installation timed out, retrying with CN mirror...'),
        );
        logger.info(
          '✺ Retrying installation with CN mirror for better speed...',
        );

        const retrySpinner = getSpinner('Retrying installation...');
        usedMirror = true;

        try {
          const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');
          await fsExtra.copy(projectCnConf, projectConf);
          await shellExec(
            `cd "${npmDirectory}" && ${packageManager} install${registryOption}${peerDepsOption}`,
            timeout,
            { ...buildEnv, CI: 'true' },
          );
          retrySpinner.succeed(
            chalk.green('Package installed with CN mirror!'),
          );
        } catch (retryError) {
          retrySpinner.fail(chalk.red('Installation failed'));
          throw retryError;
        }
      } else {
        spinner.fail(chalk.red('Installation failed'));
        throw error;
      }
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

    const packageManager = await this.detectPackageManager();
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

    // Detect available package manager
    const packageManager = await this.detectPackageManager();

    // Build app
    const buildSpinner = getSpinner('Building app...');
    // Let spinner run for a moment so user can see it, then stop before package manager command
    await new Promise((resolve) => setTimeout(resolve, 500));
    buildSpinner.stop();
    // Show static message to keep the status visible
    logger.warn('✸ Building app...');

    const baseEnv = this.getBuildEnvironment();
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
    const buildTimeout = this.getBuildTimeout();

    try {
      await shellExec(buildCommand, buildTimeout, resolveExecEnv());
    } catch (error) {
      const shouldRetryWithoutStrip =
        process.platform === 'linux' &&
        target === 'appimage' &&
        !buildEnv.NO_STRIP &&
        this.isLinuxDeployStripError(error);

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
  }

  protected getFileType(target: string): string {
    return target;
  }

  abstract getFileName(): string;

  private isLinuxDeployStripError(error: unknown): boolean {
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

  // 架构映射配置
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

  // 架构名称映射（用于文件名生成）
  protected static readonly ARCH_DISPLAY_NAMES: Record<string, string> = {
    arm64: 'aarch64',
    x64: 'x64',
    universal: 'universal',
  };

  /**
   * 解析目标架构
   */
  protected resolveTargetArch(requestedArch?: string): string {
    if (requestedArch === 'auto' || !requestedArch) {
      return process.arch;
    }
    return requestedArch;
  }

  /**
   * 获取Tauri构建目标
   */
  protected getTauriTarget(
    arch: string,
    platform: NodeJS.Platform = process.platform,
  ): string | null {
    const platformMappings = BaseBuilder.ARCH_MAPPINGS[platform];
    if (!platformMappings) return null;
    return platformMappings[arch] || null;
  }

  /**
   * 获取架构显示名称（用于文件名）
   */
  protected getArchDisplayName(arch: string): string {
    return BaseBuilder.ARCH_DISPLAY_NAMES[arch] || arch;
  }

  /**
   * 构建基础构建命令
   */
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

    return fullCommand;
  }

  /**
   * 获取构建特性列表
   */
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

    // Add features
    const features = this.getBuildFeatures();
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
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
