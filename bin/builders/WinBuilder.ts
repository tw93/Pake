import path from 'path';
import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class WinBuilder extends BaseBuilder {
  private buildFormat: string = 'msi';
  private buildArch: string;

  constructor(options: PakeAppOptions) {
    super(options);
    const validArchs = ['x64', 'arm64', 'auto'];
    this.buildArch = validArchs.includes(options.targets || '')
      ? this.resolveTargetArch(options.targets)
      : this.resolveTargetArch('auto');
    this.options.targets = this.buildFormat;
  }

  getFileName(): string {
    const { name } = this.options;
    const language = tauriConfig.bundle.windows.wix.language[0];
    const targetArch = this.getArchDisplayName(this.buildArch);
    return `${name}_${tauriConfig.version}_${targetArch}_${language}`;
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): string {
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
    const buildTarget = this.getTauriTarget(this.buildArch, 'win32');

    if (!buildTarget) {
      throw new Error(
        `Unsupported architecture: ${this.buildArch} for Windows`,
      );
    }

    let fullCommand = this.buildBaseCommand(
      packageManager,
      configPath,
      buildTarget,
    );

    const features = this.getBuildFeatures();
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
    }

    return fullCommand;
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';
    const target = this.getTauriTarget(this.buildArch, 'win32');
    return `src-tauri/target/${target}/${basePath}/bundle/`;
  }

  protected hasArchSpecificTarget(): boolean {
    return true;
  }

  protected getArchSpecificPath(): string {
    const target = this.getTauriTarget(this.buildArch, 'win32');
    return `src-tauri/target/${target}`;
  }
}
