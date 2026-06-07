import path from 'path';
import fsExtra from 'fs-extra';
import BaseBuilder from './BaseBuilder';
import { PakeAppOptions } from '@/types';
import tauriConfig from '@/helpers/tauriConfig';
import { shellExec } from '@/utils/shell';
import { generateLinuxPackageName } from '@/utils/name';
import logger from '@/options/logger';

export default class LinuxBuilder extends BaseBuilder {
  private buildFormat: string;
  private buildArch: string;
  private currentBuildType: string = '';

  constructor(options: PakeAppOptions) {
    super(options);

    const target = options.targets || 'deb';
    if (target.includes('-arm64')) {
      this.buildFormat = target.replace('-arm64', '');
      this.buildArch = 'arm64';
    } else {
      this.buildFormat = target;
      this.buildArch = this.resolveTargetArch('auto');
    }

    this.options.targets = this.buildFormat;
  }

  getFileName() {
    const { name = 'pake-app', targets } = this.options;
    const version = tauriConfig.version;
    const buildType =
      this.currentBuildType || targets.split(',').map((t) => t.trim())[0];

    let arch: string;
    if (this.buildArch === 'arm64') {
      arch =
        buildType === 'rpm' || buildType === 'appimage' ? 'aarch64' : 'arm64';
    } else {
      if (this.buildArch === 'x64') {
        arch = buildType === 'rpm' ? 'x86_64' : 'amd64';
      } else {
        arch = this.buildArch;
        if (
          this.buildArch === 'arm64' &&
          (buildType === 'rpm' || buildType === 'appimage')
        ) {
          arch = 'aarch64';
        }
      }
    }

    if (this.currentBuildType === 'rpm') {
      return `${name}-${version}-1.${arch}`;
    }

    if (this.currentBuildType === 'zst') {
      return `${name}-${version}-1-${arch}.pkg.tar`;
    }

    return `${name}_${version}_${arch}`;
  }

  async build(url: string) {
    const targetTypes = ['deb', 'appimage', 'rpm', 'zst'];
    const requestedTargets = this.options.targets
      .split(',')
      .map((t: string) => t.trim());

    for (const target of targetTypes) {
      if (requestedTargets.includes(target)) {
        this.currentBuildType = target;
        if (target === 'zst') {
          await this.buildAndCopy(url, 'deb', false);
          await this.createArchPackageFromDeb();
        } else {
          await this.buildAndCopy(url, target);
        }
      }
    }
  }

  private async createArchPackageFromDeb() {
    const { name = 'pake-app' } = this.options;
    const displayName = this.options.displayName || name;
    const packageName = generateLinuxPackageName(name);
    const version = tauriConfig.version;
    const arch = this.buildArch === 'arm64' ? 'aarch64' : 'x86_64';
    const debPath = path.resolve(`${name}.deb`);
    const packagePath = path.resolve(
      `${name}-${version}-1-${arch}.pkg.tar.zst`,
    );
    const workDir = path.resolve('.pake-arch-package');
    const dataDir = path.join(workDir, 'data');
    const controlDir = path.join(workDir, 'control');

    await fsExtra.remove(workDir);
    await fsExtra.ensureDir(dataDir);
    await fsExtra.ensureDir(controlDir);

    try {
      await shellExec(`cd "${controlDir}" && ar x "${debPath}"`);
      const dataArchive = (await fsExtra.readdir(controlDir)).find((file) =>
        file.startsWith('data.tar'),
      );
      if (!dataArchive) {
        throw new Error(`Could not find data.tar payload in ${debPath}`);
      }

      await shellExec(
        `tar -xf "${path.join(controlDir, dataArchive)}" -C "${dataDir}"`,
      );
      await fsExtra.remove(
        path.join(
          dataDir,
          'usr',
          'share',
          'applications',
          `${packageName}.desktop`,
        ),
      );

      const installedSize = await this.getDirectorySize(dataDir);
      const pkgInfo = `pkgname = ${packageName}
pkgbase = ${packageName}
pkgver = ${version}-1
pkgdesc = ${displayName} Pake app
url = https://github.com/tw93/Pake
builddate = ${Math.floor(Date.now() / 1000)}
packager = Pake
size = ${installedSize}
arch = ${arch}
license = MIT
depend = cairo
depend = desktop-file-utils
depend = gdk-pixbuf2
depend = glib2
depend = gtk3
depend = hicolor-icon-theme
depend = libsoup
depend = pango
depend = webkit2gtk-4.1
`;
      await fsExtra.writeFile(path.join(dataDir, '.PKGINFO'), pkgInfo);
      await fsExtra.writeFile(
        path.join(dataDir, '.INSTALL'),
        `post_install() {
  gtk-update-icon-cache -q -t -f usr/share/icons/hicolor
  update-desktop-database -q usr/share/applications
}

post_upgrade() {
  post_install
}

post_remove() {
  gtk-update-icon-cache -q -t -f usr/share/icons/hicolor
  update-desktop-database -q usr/share/applications
}
`,
      );
      await shellExec(
        `bsdtar --zstd -cf "${packagePath}" -C "${dataDir}" .PKGINFO .INSTALL usr`,
      );
      await fsExtra.remove(debPath);
      logger.success('✔ Build success!');
      logger.success('✔ App installer located in', packagePath);
    } finally {
      await fsExtra.remove(workDir);
    }
  }

  private async getDirectorySize(directory: string): Promise<number> {
    let size = 0;
    for (const entry of await fsExtra.readdir(directory, {
      withFileTypes: true,
    })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        size += await this.getDirectorySize(entryPath);
      } else if (entry.isFile()) {
        size += (await fsExtra.stat(entryPath)).size;
      }
    }
    return size;
  }

  // Override buildAndCopy to ensure currentBuildType is synced if called directly, though the loop above handles it most of the time.
  async buildAndCopy(url: string, target: string, logSuccess = true) {
    this.currentBuildType = target;
    await super.buildAndCopy(url, target, logSuccess);
  }

  protected getBuildCommand(packageManager: string = 'pnpm'): string {
    const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');

    const buildTarget =
      this.buildArch === 'arm64'
        ? (this.getTauriTarget(this.buildArch, 'linux') ?? undefined)
        : undefined;

    let fullCommand = this.buildBaseCommand(
      packageManager,
      configPath,
      buildTarget,
    );

    if (this.currentBuildType) {
      fullCommand += ` --bundles ${this.currentBuildType}`;
    }

    // Enable verbose output for AppImage builds when debugging or PAKE_VERBOSE is set.
    // AppImage builds often fail with minimal error messages from linuxdeploy,
    // so verbose mode helps diagnose issues like strip failures and missing dependencies.
    if (
      this.currentBuildType === 'appimage' &&
      (this.options.targets.includes('appimage') ||
        this.options.debug ||
        process.env.PAKE_VERBOSE)
    ) {
      fullCommand += ' --verbose';
    }

    return fullCommand;
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';

    if (this.buildArch === 'arm64') {
      const target = this.getTauriTarget(this.buildArch, 'linux');
      return `src-tauri/target/${target}/${basePath}/bundle/`;
    }

    return super.getBasePath();
  }

  protected getFileType(target: string): string {
    if (target === 'appimage') {
      return 'AppImage';
    }
    if (target === 'zst') {
      return 'zst';
    }
    return super.getFileType(target);
  }

  protected hasArchSpecificTarget(): boolean {
    return this.buildArch === 'arm64';
  }

  protected getArchSpecificPath(): string {
    if (this.buildArch === 'arm64') {
      const target = this.getTauriTarget(this.buildArch, 'linux');
      return `src-tauri/target/${target}`;
    }
    return super.getArchSpecificPath();
  }
}
