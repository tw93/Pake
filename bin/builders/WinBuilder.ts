import path from 'path';
import fsExtra from 'fs-extra';
import BaseBuilder from './BaseBuilder';

import logger from '@/options/logger';
import tauriConfig from '@/helpers/tauriConfig';
import { npmDirectory } from '@/utils/dir';
import { PakeAppOptions } from '@/types';
import { mergeConfig } from '@/helpers/merge';

export default class WinBuilder extends BaseBuilder {
  async build(url: string, options: PakeAppOptions) {
    const { name } = options;
    await mergeConfig(url, options, tauriConfig);
    await this.runBuildCommand(npmDirectory, 'npm run build');

    const language = tauriConfig.tauri.bundle.windows.wix.language[0];
    const arch = process.arch;
    const msiName = `${name}_${tauriConfig.package.version}_${arch}_${language}.msi`;
    const appPath = this.getBuildAppPath(npmDirectory, msiName);
    const distPath = path.resolve(`${name}.msi`);
    await fsExtra.copy(appPath, distPath);
    await fsExtra.remove(appPath);
    logger.success('Build success!');
    logger.success('App installer located in', distPath);
  }

  getBuildAppPath(npmDirectory: string, msiName: string) {
    return path.join(
      npmDirectory,
      'src-tauri/target/release/bundle/msi',
      msiName
    );
  }
}
