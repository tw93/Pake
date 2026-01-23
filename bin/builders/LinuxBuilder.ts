import path from 'path';
import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class LinuxBuilder extends BaseBuilder {
  private buildFormat: string;
  private buildArch: string;
  private currentBuildType: string = '';

  constructor(options: PakeAppOptions) {
    super(options);

    const target = options.targets || 'deb';
    if (target.includes('-arm64')) {
      this.buildFormat = target.replace('-arm64', '');
      this.buildArch = 'arm64';
    } else {
      this.buildFormat = target;
      this.buildArch = this.resolveTargetArch('auto');
    }

    this.options.targets = this.buildFormat;
  }

  getFileName() {
    const { name = 'pake-app', targets } = this.options;
    const version = tauriConfig.version;
    const buildType =
      this.currentBuildType || targets.split(',').map((t) => t.trim())[0];

    let arch: string;
    if (this.buildArch === 'arm64') {
      arch =
        buildType === 'rpm' || buildType === 'appimage' ? 'aarch64' : 'arm64';
    } else {
      if (this.buildArch === 'x64') {
        arch = buildType === 'rpm' ? 'x86_64' : 'amd64';
      } else {
        arch = this.buildArch;
        if (
          this.buildArch === 'arm64' &&
          (buildType === 'rpm' || buildType === 'appimage')
        ) {
          arch = 'aarch64';
        }
      }
    }

    if (this.currentBuildType === 'rpm') {
      return `${name}-${version}-1.${arch}`;
    }

    return `${name}_${version}_${arch}`;
  }

  async build(url: string) {
    const targetTypes = ['deb', 'appimage', 'rpm'];
    const requestedTargets = this.options.targets
      .split(',')
      .map((t: string) => t.trim());

    for (const target of targetTypes) {
      if (requestedTargets.includes(target)) {
        this.currentBuildType = target;
        await this.buildAndCopy(url, target);
      }
    }
  }

  // Override buildAndCopy to ensure currentBuildType is synced if called directly, though the loop above handles it most of the time.
  async buildAndCopy(url: string, target: string) {
    this.currentBuildType = target;
    await super.buildAndCopy(url, target);
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): string {
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');

    const buildTarget =
      this.buildArch === 'arm64'
        ? (this.getTauriTarget(this.buildArch, 'linux') ?? undefined)
        : undefined;

    let fullCommand = this.buildBaseCommand(
      packageManager,
      configPath,
      buildTarget,
    );

    const features = this.getBuildFeatures();
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
    }

    if (this.currentBuildType) {
      fullCommand += ` --bundles ${this.currentBuildType}`;
    }

    // Enable verbose output for AppImage builds when debugging or PAKE_VERBOSE is set.
    // AppImage builds often fail with minimal error messages from linuxdeploy,
    // so verbose mode helps diagnose issues like strip failures and missing dependencies.
    if (
      this.currentBuildType === 'appimage' &&
      (this.options.targets.includes('appimage') ||
        this.options.debug ||
        process.env.PAKE_VERBOSE)
    ) {
      fullCommand += ' --verbose';
    }

    return fullCommand;
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';

    if (this.buildArch === 'arm64') {
      const target = this.getTauriTarget(this.buildArch, 'linux');
      return `src-tauri/target/${target}/${basePath}/bundle/`;
    }

    return super.getBasePath();
  }

  protected getFileType(target: string): string {
    if (target === 'appimage') {
      return 'AppImage';
    }
    return super.getFileType(target);
  }

  protected hasArchSpecificTarget(): boolean {
    return this.buildArch === 'arm64';
  }

  protected getArchSpecificPath(): string {
    if (this.buildArch === 'arm64') {
      const target = this.getTauriTarget(this.buildArch, 'linux');
      return `src-tauri/target/${target}`;
    }
    return super.getArchSpecificPath();
  }
}
