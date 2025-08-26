import path from 'path';
import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class LinuxBuilder extends BaseBuilder {
  private buildFormat: string;
  private buildArch: string;

  constructor(options: PakeAppOptions) {
    super(options);

    // Parse target format and architecture
    const target = options.targets || 'deb';
    if (target.includes('-arm64')) {
      this.buildFormat = target.replace('-arm64', '');
      this.buildArch = 'arm64';
    } else {
      this.buildFormat = target;
      this.buildArch = this.resolveTargetArch('auto');
    }

    // Set targets to format for Tauri
    this.options.targets = this.buildFormat;
  }

  getFileName() {
    const { name, targets } = this.options;
    const version = tauriConfig.version;

    // Determine architecture display name
    let arch: string;
    if (this.buildArch === 'arm64') {
      arch = targets === 'rpm' || targets === 'appimage' ? 'aarch64' : 'arm64';
    } else {
      // Auto-detect or default to current architecture
      const resolvedArch = this.buildArch === 'x64' ? 'amd64' : this.buildArch;
      arch = resolvedArch;
      if (
        resolvedArch === 'arm64' &&
        (targets === 'rpm' || targets === 'appimage')
      ) {
        arch = 'aarch64';
      }
    }

    // The RPM format uses different separators and version number formats
    if (targets === 'rpm') {
      return `${name}-${version}-1.${arch}`;
    }

    return `${name}_${version}_${arch}`;
  }

  // Customize it, considering that there are all targets.
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

    // Only add target if it's ARM64
    const buildTarget =
      this.buildArch === 'arm64'
        ? this.getTauriTarget(this.buildArch, 'linux')
        : undefined;

    let fullCommand = this.buildBaseCommand(
      packageManager,
      configPath,
      buildTarget,
    );

    // Add features
    const features = this.getBuildFeatures();
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
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
}
