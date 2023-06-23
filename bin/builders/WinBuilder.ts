import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class WinBuilder extends BaseBuilder {
  constructor(options: PakeAppOptions) {
    super(options);
  }

  async build(url: string) {
    await this.buildAndCopy(url);
  }

  getFileName(): string {
    const { name } = this.options;
    const arch = this.getArch();
    const language = tauriConfig.tauri.bundle.windows.wix.language[0];
    return `${name}_${tauriConfig.package.version}_${arch}_${language}`;
  }

  getExtension(): string {
    return "msi";
  }
}
