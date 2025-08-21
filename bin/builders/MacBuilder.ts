import path from 'path';
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
    if (this.options.multiArch) {
      const baseCommand = this.options.debug
        ? 'npm run tauri build -- --debug'
        : 'npm run tauri build --';

      // Use temporary config directory to avoid modifying source files
      const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
      let fullCommand = `${baseCommand} --target universal-apple-darwin -c "${configPath}"`;

      // Add features
      const features = ['cli-build'];

      // Add macos-proxy feature for modern macOS (Darwin 23+ = macOS 14+)
      const macOSVersion = this.getMacOSMajorVersion();
      if (macOSVersion >= 23) {
        features.push('macos-proxy');
      }

      if (features.length > 0) {
        fullCommand += ` --features ${features.join(',')}`;
      }

      return fullCommand;
    }
    return super.getBuildCommand();
  }

  protected getBasePath(): string {
    return this.options.multiArch
      ? 'src-tauri/target/universal-apple-darwin/release/bundle'
      : super.getBasePath();
  }
}
