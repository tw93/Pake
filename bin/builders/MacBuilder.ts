import path from 'path';
import tauriConfig from '@/helpers/tauriConfig';
import { PakeAppOptions } from '@/types';
import BaseBuilder from './BaseBuilder';

export default class MacBuilder extends BaseBuilder {
  private buildFormat: string;
  private buildArch: string;

  constructor(options: PakeAppOptions) {
    super(options);

    // Store the original targets value for architecture selection
    this.buildArch = options.targets || 'auto';

    // Use DMG by default for distribution
    // Only create app bundles for testing to avoid user interaction
    if (process.env.PAKE_CREATE_APP === '1') {
      this.buildFormat = 'app';
    } else {
      this.buildFormat = 'dmg';
    }

    // Set targets to format for Tauri
    this.options.targets = this.buildFormat;
  }

  getFileName(): string {
    const { name } = this.options;

    // For app bundles, use simple name without version/arch
    if (this.buildFormat === 'app') {
      return name;
    }

    // For DMG files, use versioned filename
    let arch: string;
    if (this.buildArch === 'universal' || this.options.multiArch) {
      arch = 'universal';
    } else if (this.buildArch === 'apple') {
      arch = 'aarch64';
    } else if (this.buildArch === 'intel') {
      arch = 'x64';
    } else {
      // Auto-detect based on current architecture
      arch = process.arch === 'arm64' ? 'aarch64' : process.arch;
    }
    return `${name}_${tauriConfig.version}_${arch}`;
  }

  protected getBuildCommand(): string {
    // Determine if we need universal build
    const needsUniversal =
      this.buildArch === 'universal' || this.options.multiArch;

    if (needsUniversal) {
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
    } else if (this.buildArch === 'apple') {
      // Build for Apple Silicon only
      const baseCommand = this.options.debug
        ? 'npm run tauri build -- --debug'
        : 'npm run tauri build --';
      const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
      let fullCommand = `${baseCommand} --target aarch64-apple-darwin -c "${configPath}"`;

      // Add features
      const features = ['cli-build'];
      const macOSVersion = this.getMacOSMajorVersion();
      if (macOSVersion >= 23) {
        features.push('macos-proxy');
      }
      if (features.length > 0) {
        fullCommand += ` --features ${features.join(',')}`;
      }

      return fullCommand;
    } else if (this.buildArch === 'intel') {
      // Build for Intel only
      const baseCommand = this.options.debug
        ? 'npm run tauri build -- --debug'
        : 'npm run tauri build --';
      const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
      let fullCommand = `${baseCommand} --target x86_64-apple-darwin -c "${configPath}"`;

      // Add features
      const features = ['cli-build'];
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
    const needsUniversal =
      this.buildArch === 'universal' || this.options.multiArch;
    const basePath = this.options.debug ? 'debug' : 'release';

    if (needsUniversal) {
      return `src-tauri/target/universal-apple-darwin/${basePath}/bundle`;
    } else if (this.buildArch === 'apple') {
      return `src-tauri/target/aarch64-apple-darwin/${basePath}/bundle`;
    } else if (this.buildArch === 'intel') {
      return `src-tauri/target/x86_64-apple-darwin/${basePath}/bundle`;
    }

    return super.getBasePath();
  }
}
