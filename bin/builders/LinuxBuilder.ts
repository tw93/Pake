import path from 'path';
import fsExtra from "fs-extra";
import BaseBuilder from './BaseBuilder';

import logger from '@/options/logger';
import tauriConfig from '@/helpers/tauriConfig';
import { npmDirectory } from '@/utils/dir';
import { PakeAppOptions } from '@/types';
import { mergeConfig } from "@/builders/common";

export default class LinuxBuilder extends BaseBuilder {
  async build(url: string, options: PakeAppOptions) {
    const { name } = options;
    await mergeConfig(url, options, tauriConfig);
    await this.runBuildCommand(npmDirectory, 'npm run build');

    const arch = process.arch === "x64" ? "amd64" : process.arch;

    if (options.targets === "deb" || options.targets === "all") {
      const debName = `${name}_${tauriConfig.package.version}_${arch}.deb`;
      const appPath = this.getBuildAppPath(npmDirectory, "deb", debName);
      const distPath = path.resolve(`${name}.deb`);
      await fsExtra.copy(appPath, distPath);
      await fsExtra.remove(appPath);
      logger.success('Build Deb success!');
      logger.success('Deb app installer located in', distPath);
    }

    if (options.targets === "appimage" || options.targets === "all") {
      const appImageName = `${name}_${tauriConfig.package.version}_${arch}.AppImage`;
      const appImagePath = this.getBuildAppPath(npmDirectory, "appimage", appImageName);
      const distAppPath = path.resolve(`${name}.AppImage`);
      await fsExtra.copy(appImagePath, distAppPath);
      await fsExtra.remove(appImagePath);
      logger.success('Build AppImage success!');
      logger.success('AppImage installer located in', distAppPath);
    }
  }

  getBuildAppPath(npmDirectory: string, packageType: string, packageName: string) {
    return path.join(
      npmDirectory,
      'src-tauri/target/release/bundle/',
      packageType,
      packageName
    );
  }
}
