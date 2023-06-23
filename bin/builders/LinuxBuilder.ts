import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class LinuxBuilder extends BaseBuilder {
  constructor(options: PakeAppOptions) {
    super(options);
  }

  async build(url: string) {
    const targetTypes = ['deb', 'appimage'];
    for (const type of targetTypes) {
      if (this.options.targets === type || this.options.targets === "all") {
        await this.buildAndCopy(url);
      }
    }
  }

  getFileName(): string {
    const { name } = this.options;
    const arch = this.getArch();
    return `${name}_${tauriConfig.package.version}_${arch}`;
  }

  getExtension(): string {
    if (this.options.targets === 'appimage') {
      return 'AppImage';
    }
    return this.options.targets;
  }
}
