import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class LinuxBuilder extends BaseBuilder {
  constructor(options: PakeAppOptions) {
    super(options);
  }

  getFileName() {
    const { name, targets } = this.options;
    const version = tauriConfig.version;

    let arch = process.arch === 'x64' ? 'amd64' : process.arch;
    if (arch === 'arm64' && (targets === 'rpm' || targets === 'appimage')) {
      arch = 'aarch64';
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

  protected getFileType(target: string): string {
    if (target === 'appimage') {
      return 'AppImage';
    }
    return super.getFileType(target);
  }
}
