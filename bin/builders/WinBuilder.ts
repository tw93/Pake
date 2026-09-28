import path from 'path';
import fsExtra from 'fs-extra';
import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import { generateIdentifierSafeName } from '@/utils/name';
import type { ShellCommand } from '@/utils/shell';
import logger from '@/options/logger';

const WEBVIEW2_LOADER_DLL = 'WebView2Loader.dll';

export default class WinBuilder extends BaseBuilder {
  private buildFormat: string = 'msi';
  private buildArch: string;
  private toolchain: 'msvc' | 'gnu';
  private keptLoaderDllPath: string | null = null;

  // MSYS2/MinGW only ships an x86_64 GCC toolchain, so gnu is x64-only;
  // arm64 falls through to getTauriTarget returning null, which the
  // existing call sites already turn into "Unsupported architecture".
  private static readonly GNU_ARCH_MAPPINGS: Record<string, string> = {
    x64: 'x86_64-pc-windows-gnu',
  };

  constructor(options: PakeAppOptions) {
    super(options);
    const validArchs = ['x64', 'arm64', 'auto'];
    this.buildArch = validArchs.includes(options.targets || '')
      ? this.resolveTargetArch(options.targets)
      : this.resolveTargetArch('auto');
    this.toolchain = options.windowsToolchain === 'gnu' ? 'gnu' : 'msvc';
    this.options.targets = this.buildFormat;
  }

  getReportArch(): string {
    return this.buildArch;
  }

  protected getTauriTarget(
    arch: string,
    platform: NodeJS.Platform = 'win32',
  ): string | null {
    if (this.toolchain === 'gnu') {
      return WinBuilder.GNU_ARCH_MAPPINGS[arch] || null;
    }
    return super.getTauriTarget(arch, platform);
  }

  getFileName(): string {
    const { name } = this.options;
    const language = this.options.installerLanguage;
    const targetArch = this.getArchDisplayName(this.buildArch);
    return `${name}_${this.options.appVersion}_${targetArch}_${language}`;
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): ShellCommand {
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
    const buildTarget = this.getTauriTarget(this.buildArch, 'win32');

    if (!buildTarget) {
      throw new Error(
        `Unsupported architecture: ${this.buildArch} for Windows`,
      );
    }

    return this.buildBaseCommand(packageManager, configPath, buildTarget);
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';
    const target = this.getTauriTarget(this.buildArch, 'win32');
    if (!target) {
      throw new Error(
        `Unsupported architecture: ${this.buildArch} for Windows`,
      );
    }
    return path.join(this.getCargoTargetDir(), target, basePath, 'bundle');
  }

  protected hasArchSpecificTarget(): boolean {
    return true;
  }

  protected getArchSpecificPath(): string {
    const target = this.getTauriTarget(this.buildArch, 'win32');
    if (!target) {
      throw new Error(
        `Unsupported architecture: ${this.buildArch} for Windows`,
      );
    }
    return path.join(this.getCargoTargetDir(), target);
  }

  protected getRawBinaryPath(appName: string): string {
    return `${appName}.exe`;
  }

  protected getBinaryName(appName: string): string {
    return `pake-${generateIdentifierSafeName(appName)}.exe`;
  }

  protected async copyRawBinary(
    npmDirectory: string,
    appName: string,
  ): Promise<void> {
    await super.copyRawBinary(npmDirectory, appName);
    if (this.toolchain !== 'gnu') return;

    // GNU builds import WebView2Loader.dll at runtime (MSVC links
    // WebView2LoaderStatic); tauri-build places it beside the binary and the
    // MSI bundles it, so the kept .exe needs it beside it too.
    const src = path.join(
      path.dirname(this.getRawBinarySourcePath(npmDirectory, appName)),
      WEBVIEW2_LOADER_DLL,
    );
    const dest = path.join(
      path.dirname(path.resolve(this.getRawBinaryPath(appName))),
      WEBVIEW2_LOADER_DLL,
    );
    if (await fsExtra.pathExists(src)) {
      await fsExtra.copy(src, dest);
      this.keptLoaderDllPath = dest;
    } else {
      logger.warn(
        `✼ ${WEBVIEW2_LOADER_DLL} not found at ${src}; the raw binary will not start without it.`,
      );
    }
  }

  protected async copyBuildArtifacts(target: string, logSuccess = true) {
    await super.copyBuildArtifacts(target, logSuccess);
    if (!this.keptLoaderDllPath) return;

    await this.recordArtifact(this.keptLoaderDllPath, 'dll');
    if (logSuccess) {
      logger.success(
        `✔ ${WEBVIEW2_LOADER_DLL} copied beside it — keep them together`,
      );
    }
  }
}
