import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class WinBuilder extends BaseBuilder {
  constructor(options: PakeAppOptions) {
    super(options);
    this.options.targets = "msi";
  }

  getFileName(): string {
    const { name } = this.options;
    const { arch } = process;
    const language = tauriConfig.tauri.bundle.windows.wix.language[0];
    return `${name}_${tauriConfig.package.version}_${arch}_${language}`;
  }
}
