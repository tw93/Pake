import tauriConfig from '@/helpers/tauriConfig';
import { PakeAppOptions } from '@/types';
import BaseBuilder from './BaseBuilder';

export default class MacBuilder extends BaseBuilder {
  constructor(options: PakeAppOptions) {
    super(options);
  }

  async build(url: string) {
    await this.buildAndCopy(url);
  }

  getFileName(): string {
    const { name } = this.options;
    let arch: string;
    if (this.options.multiArch) {
      arch = 'universal';
    } else {
      arch = process.arch === "arm64" ? "aarch64" : process.arch;
    }
    return `${name}_${tauriConfig.package.version}_${arch}`;
  }

  getExtension(): string {
    return "dmg";
  }

  protected getBuildCommand(): string {
    return this.options.multiArch ? 'npm run build:mac' : super.getBuildCommand();
  }

  protected getBasePath(): string {
    return this.options.multiArch
      ? 'src-tauri/target/universal-apple-darwin/release/bundle'
      : super.getBasePath();
  }
}
