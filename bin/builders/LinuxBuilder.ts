import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class LinuxBuilder extends BaseBuilder {
  constructor(options: PakeAppOptions) {
    super(options);
  }

  getFileName(): string {
    const { name } = this.options;
    const arch = process.arch === 'x64' ? 'amd64' : process.arch;
    return `${name}_${tauriConfig.package.version}_${arch}`;
  }

  // Customize it, considering that there are all targets.
  async build(url: string) {
    const targetTypes = ['deb', 'appimage'];
    for (const target of targetTypes) {
      if (this.options.targets === target || this.options.targets === 'all') {
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
