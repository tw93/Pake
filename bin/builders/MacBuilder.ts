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
    // For macOS, targets can be architecture names or format names
    // Filter out non-architecture values
    const validArchs = ['intel', 'apple', 'universal', 'auto', 'x64', 'arm64'];
    this.buildArch = validArchs.includes(options.targets || '')
      ? options.targets
      : 'auto';

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
      arch = this.getArchDisplayName(this.resolveTargetArch(this.buildArch));
    }
    return `${name}_${tauriConfig.version}_${arch}`;
  }

  private getActualArch(): string {
    if (this.buildArch === 'universal' || this.options.multiArch) {
      return 'universal';
    } else if (this.buildArch === 'apple') {
      return 'arm64';
    } else if (this.buildArch === 'intel') {
      return 'x64';
    }
    return this.resolveTargetArch(this.buildArch);
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): string {
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
    const actualArch = this.getActualArch();

    const buildTarget = this.getTauriTarget(actualArch, 'darwin');
    if (!buildTarget) {
      throw new Error(`Unsupported architecture: ${actualArch} for macOS`);
    }

    let fullCommand = this.buildBaseCommand(
      packageManager,
      configPath,
      buildTarget,
    );

    // Add features
    const features = this.getBuildFeatures();
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
    }

    return fullCommand;
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';
    const actualArch = this.getActualArch();
    const target = this.getTauriTarget(actualArch, 'darwin');

    return `src-tauri/target/${target}/${basePath}/bundle`;
  }
}
