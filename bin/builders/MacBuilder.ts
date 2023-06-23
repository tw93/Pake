import path from 'path';
import fsExtra from "fs-extra";

import BaseBuilder from './BaseBuilder';
import logger from '@/options/logger';
import tauriConfig from '@/helpers/tauriConfig';
import { npmDirectory } from '@/utils/dir';
import { mergeConfig } from "@/helpers/merge";
import { PakeAppOptions } from '@/types';

export default class MacBuilder extends BaseBuilder {
  async build(url: string, options: PakeAppOptions) {
    const { name } = options;
    await mergeConfig(url, options, tauriConfig);
    let dmgName: string;
    if (options.multiArch) {
      await this.runBuildCommand('npm run build:mac');
      dmgName = `${name}_${tauriConfig.package.version}_universal.dmg`;
    } else {
      await this.runBuildCommand();
      let arch = process.arch === "arm64" ? "aarch64" : process.arch;
      dmgName = `${name}_${tauriConfig.package.version}_${arch}.dmg`;
    }
    const appPath = this.getBuildAppPath(npmDirectory, dmgName, options.multiArch);
    const distPath = path.resolve(`${name}.dmg`);
    await fsExtra.copy(appPath, distPath);
    await fsExtra.remove(appPath);
    logger.success('✔ Build success!');
    logger.success('✔ App installer located in', distPath);
  }

  getBuildAppPath(npmDirectory: string, dmgName: string, multiArch: boolean) {
    const dmgPath = multiArch ? 'src-tauri/target/universal-apple-darwin/release/bundle/dmg' : 'src-tauri/target/release/bundle/dmg';
    return path.join(npmDirectory, dmgPath, dmgName);
  }
}
