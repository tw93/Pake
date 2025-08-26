import path from 'path';
import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';

export default class WinBuilder extends BaseBuilder {
  private buildFormat: string = 'msi';
  private buildArch: string;

  constructor(options: PakeAppOptions) {
    super(options);
    // Store the original targets value for architecture selection
    this.buildArch = options.targets || 'auto';
    // Set targets to msi format for Tauri
    this.options.targets = this.buildFormat;
  }

  getFileName(): string {
    const { name } = this.options;
    const language = tauriConfig.bundle.windows.wix.language[0];

    // Determine architecture name based on explicit targets option or auto-detect
    let targetArch: string;
    if (this.buildArch === 'arm64') {
      targetArch = 'aarch64';
    } else if (this.buildArch === 'x64') {
      targetArch = 'x64';
    } else {
      // Auto-detect based on current architecture if no explicit target
      const archMap: { [key: string]: string } = {
        x64: 'x64',
        arm64: 'aarch64',
      };
      targetArch = archMap[process.arch] || process.arch;
    }

    return `${name}_${tauriConfig.version}_${targetArch}_${language}`;
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): string {
    const baseCommand = this.options.debug
      ? `${packageManager} run build:debug`
      : `${packageManager} run build`;

    // Use temporary config directory to avoid modifying source files
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
    let fullCommand = `${baseCommand} -- -c "${configPath}"`;

    // Determine build target based on explicit targets option or auto-detect
    let buildTarget: string;
    if (this.buildArch === 'arm64') {
      buildTarget = 'aarch64-pc-windows-msvc';
    } else if (this.buildArch === 'x64') {
      buildTarget = 'x86_64-pc-windows-msvc';
    } else {
      // Auto-detect based on current architecture if no explicit target
      buildTarget =
        process.arch === 'arm64'
          ? 'aarch64-pc-windows-msvc'
          : 'x86_64-pc-windows-msvc';
    }

    fullCommand += ` --target ${buildTarget}`;

    // Add features
    const features = ['cli-build'];
    if (features.length > 0) {
      fullCommand += ` --features ${features.join(',')}`;
    }

    return fullCommand;
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';

    // Determine target based on explicit targets option or auto-detect
    let target: string;
    if (this.buildArch === 'arm64') {
      target = 'aarch64-pc-windows-msvc';
    } else if (this.buildArch === 'x64') {
      target = 'x86_64-pc-windows-msvc';
    } else {
      // Auto-detect based on current architecture if no explicit target
      target =
        process.arch === 'arm64'
          ? 'aarch64-pc-windows-msvc'
          : 'x86_64-pc-windows-msvc';
    }

    return `src-tauri/target/${target}/${basePath}/bundle/`;
  }
}
