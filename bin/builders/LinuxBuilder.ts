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
    // write desktop
    const assertSrc = `src-tauri/assets/${name}.desktop`;
    const assertPath = path.join(npmDirectory, assertSrc);
    const desktopStr = `
[Desktop Entry]
Encoding=UTF-8
Categories=Office
Exec=${name}
Icon=${name}
Name=${name}
StartupNotify=true
Terminal=false
Type=Application
    `
    await fs.writeFile(assertPath, desktopStr);
    const _ = await shellExec(`cd ${npmDirectory} && npm install && npm run build`);
    let arch = "";
    if (process.arch === "x64") {
      arch = "amd64";
    } else {
      arch = process.arch;
    }
    const debName = `${name}_${tauriConf.package.version}_${arch}.deb`;
    const appPath = this.getBuildedAppPath(npmDirectory, debName);
    const distPath = path.resolve(`${name}.deb`);
    await fs.copyFile(appPath, distPath);
    await fs.unlink(appPath);
    logger.success('Build success!');
    logger.success('You can find the app installer in', distPath);
  }

  getBuildedAppPath(npmDirectory: string, dmgName: string) {
    return path.join(
      npmDirectory,
      'src-tauri/target/release/bundle/deb',
      dmgName
    );
  }
}