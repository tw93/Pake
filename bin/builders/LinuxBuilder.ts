import path from 'path';
import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class LinuxBuilder extends BaseBuilder {
  private buildFormat: string;
  private buildArch: string;

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
    const { name, targets } = this.options;
    const version = tauriConfig.version;

    let arch: string;
    if (this.buildArch === 'arm64') {
      arch = targets === 'rpm' || targets === 'appimage' ? 'aarch64' : 'arm64';
    } else {
      if (this.buildArch === 'x64') {
        arch = targets === 'rpm' ? 'x86_64' : 'amd64';
      } else {
        arch = this.buildArch;
        if (
          this.buildArch === 'arm64' &&
          (targets === 'rpm' || targets === 'appimage')
        ) {
          arch = 'aarch64';
        }
      }
    }

    if (targets === 'rpm') {
      return `${name}-${version}-1.${arch}`;
    }

    return `${name}_${version}_${arch}`;
  }

  async build(url: string) {
    const targetTypes = ['deb', 'appimage', 'rpm'];
    for (const target of targetTypes) {
      if (this.options.targets === target) {
        await this.buildAndCopy(url, target);
      }
    }
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): string {
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');

    const buildTarget =
      this.buildArch === 'arm64'
        ? this.getTauriTarget(this.buildArch, 'linux')
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

    // Enable verbose output for AppImage builds when debugging or PAKE_VERBOSE is set.
    // AppImage builds often fail with minimal error messages from linuxdeploy,
    // so verbose mode helps diagnose issues like strip failures and missing dependencies.
    if (
      this.options.targets === 'appimage' &&
      (this.options.debug || process.env.PAKE_VERBOSE)
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
