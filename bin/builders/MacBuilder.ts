import path from 'path';
import tauriConfig from '@/helpers/tauriConfig';
import { PakeAppOptions } from '@/types';
import BaseBuilder from './BaseBuilder';

export default class MacBuilder extends BaseBuilder {
  private buildFormat: string;
  private buildArch: string;

  constructor(options: PakeAppOptions) {
    super(options);

    const validArchs = ['intel', 'apple', 'universal', 'auto', 'x64', 'arm64'];
    this.buildArch = validArchs.includes(options.targets || '')
      ? options.targets
      : 'auto';

    // `app` is a valid macOS bundle target (see merge.ts); honour it explicitly.
    if (
      options.targets === 'app' ||
      options.iterativeBuild ||
      options.install ||
      process.env.PAKE_CREATE_APP === '1'
    ) {
      this.buildFormat = 'app';
    } else {
      this.buildFormat = 'dmg';
    }

    this.options.targets = this.buildFormat;
  }

  getFileName(): string {
    const { name = 'pake-app' } = this.options;

    if (this.buildFormat === 'app') {
      return name;
    }

    let arch: string;
    if (this.buildArch === 'universal' || this.options.multiArch) {
      arch = 'universal';
    } else if (this.buildArch === 'apple') {
      arch = 'aarch64';
    } else if (this.buildArch === 'intel') {
      arch = 'x64';
    } else {
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

    return this.buildBaseCommand(packageManager, configPath, buildTarget);
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';
    const actualArch = this.getActualArch();
    const target = this.getTauriTarget(actualArch, 'darwin');

    if (!target) {
      throw new Error(`Unsupported architecture: ${actualArch} for macOS`);
    }

    return path.join(this.getCargoTargetDir(), target, basePath, 'bundle');
  }

  protected hasArchSpecificTarget(): boolean {
    return true;
  }

  protected getArchSpecificPath(): string {
    const actualArch = this.getActualArch();
    const target = this.getTauriTarget(actualArch, 'darwin');
    if (!target) {
      throw new Error(`Unsupported architecture: ${actualArch} for macOS`);
    }
    return path.join(this.getCargoTargetDir(), target);
  }
}
