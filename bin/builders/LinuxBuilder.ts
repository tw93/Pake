import fs from 'fs/promises';
import path from 'path';
import prompts from 'prompts';
import { checkRustInstalled, installRust } from '@/helpers/rust.js';
import { PakeAppOptions } from '@/types.js';
import { IBuilder } from './base.js';
import { shellExec } from '@/utils/shell.js';
// @ts-expect-error 加上resolveJsonModule rollup会打包报错
// import tauriConf from '../../src-tauri/tauri.windows.conf.json';
import tauriConf from './tauriConf.js';

import { fileURLToPath } from 'url';
import logger from '@/options/logger.js';
import { mergeTauriConfig } from './common.js';
import { npmDirectory } from '@/utils/dir.js';

export default class LinuxBuilder implements IBuilder {
  async prepare() {
    logger.info(
      'To build the Linux app, you need to install Rust and Linux package'
    );
    logger.info(
      'See more in https://tauri.app/v1/guides/getting-started/prerequisites#installing\n'
    );
    if (checkRustInstalled()) {
      return;
    }

    const res = await prompts({
      type: 'confirm',
      message: 'We detected that you have not installed Rust. Install it now?',
      name: 'value',
    });

    if (res.value) {
      // TODO 国内有可能会超时
      await installRust();
    } else {
      logger.error('Error: Pake needs Rust to package your webapp!!!');
      process.exit(2);
    }
  }

  async build(url: string, options: PakeAppOptions) {
    logger.debug('PakeAppOptions', options);
    const { name } = options;

    await mergeTauriConfig(url, options, tauriConf);
    const _ = await shellExec(`cd ${npmDirectory} && npm install && npm run build`);
    let arch = "";
    if (process.arch === "x64") {
      arch = "amd64";
    } else {
      arch = process.arch;
    }
    const debName = `${name}_${tauriConf.package.version}_${arch}.deb`;
    const appPath = this.getBuildedAppPath(npmDirectory, "deb", debName);
    const distPath = path.resolve(`${name}.deb`);
    await fs.copyFile(appPath, distPath);
    await fs.unlink(appPath);


    const appImageName = `${name}_${tauriConf.package.version}_${arch}.AppImage`;
    const appImagePath = this.getBuildedAppPath(npmDirectory, "appimage", appImageName);
    const distAppPath = path.resolve(`${name}.AppImage`);
    await fs.copyFile(appImagePath, distAppPath);
    await fs.unlink(appImagePath);
    logger.success('Build success!');
    logger.success('You can find the deb app installer in', distPath);
    logger.success('You can find the Appimage app installer in', distAppPath);
  }

  getBuildedAppPath(npmDirectory: string,packageType: string, packageName: string) {
    return path.join(
      npmDirectory,
      'src-tauri/target/release/bundle/',
      packageType,
      packageName
    );
  }
}