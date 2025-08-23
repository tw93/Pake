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
      this.buildArch = 'auto';
    }

    // Set targets to format for Tauri
    this.options.targets = this.buildFormat;
  }

  getFileName() {
    const { name, targets } = this.options;
    const version = tauriConfig.version;

    // Determine architecture based on explicit target or auto-detect
    let arch: string;
    if (this.buildArch === 'arm64') {
      arch = targets === 'rpm' || targets === 'appimage' ? 'aarch64' : 'arm64';
    } else {
      // Auto-detect or default to current architecture
      arch = process.arch === 'x64' ? 'amd64' : process.arch;
      if (arch === 'arm64' && (targets === 'rpm' || targets === 'appimage')) {
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

  protected getBuildCommand(): string {
    const baseCommand = this.options.debug
      ? 'npm run build:debug'
      : 'npm run build';

    // Use temporary config directory to avoid modifying source files
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
    let fullCommand = `${baseCommand} -- -c "${configPath}"`;

    // Add ARM64 target if explicitly specified
    if (this.buildArch === 'arm64') {
      fullCommand += ' --target aarch64-unknown-linux-gnu';
    }

    // Add features
    const features = ['cli-build'];
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
    }

    return fullCommand;
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';

    if (this.buildArch === 'arm64') {
      return `src-tauri/target/aarch64-unknown-linux-gnu/${basePath}/bundle/`;
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
