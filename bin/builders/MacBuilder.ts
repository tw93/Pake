import tauriConfig from '@/helpers/tauriConfig';
import { PakeAppOptions } from '@/types';
import BaseBuilder from './BaseBuilder';

export default class MacBuilder extends BaseBuilder {
  constructor(options: PakeAppOptions) {
    super(options);
    // Use DMG by default for distribution
    // Only create app bundles for testing to avoid user interaction
    if (process.env.PAKE_CREATE_APP === '1') {
      this.options.targets = 'app';
    } else {
      this.options.targets = 'dmg';
    }
  }

  getFileName(): string {
    const { name } = this.options;

    // For app bundles, use simple name without version/arch
    if (this.options.targets === 'app') {
      return name;
    }

    // For DMG files, use versioned filename
    let arch: string;
    if (this.options.multiArch) {
      arch = 'universal';
    } else {
      arch = process.arch === 'arm64' ? 'aarch64' : process.arch;
    }
    return `${name}_${tauriConfig.version}_${arch}`;
  }

  protected getBuildCommand(): string {
    return this.options.multiArch
      ? 'npm run build:mac'
      : super.getBuildCommand();
  }

  protected getBasePath(): string {
    return this.options.multiArch
      ? 'src-tauri/target/universal-apple-darwin/release/bundle'
      : super.getBasePath();
  }
}
