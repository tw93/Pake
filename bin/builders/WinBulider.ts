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
import {isChinaDomain} from '@/utils/ip_addr.js';

export default class WinBuilder implements IBuilder {
  async prepare() {
    logger.info(
      'To build the Windows app, you need to install Rust and VS Build Tools.'
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
    const isChina = await isChinaDomain("www.npmjs.com")
    if (isChina) {
      logger.info("it's in China, use npm/rust cn mirror")
      const rust_project_dir = path.join(npmDirectory, 'src-tauri', ".cargo");
      const e1 = fs.access(rust_project_dir);
      if (e1) {
        await fs.mkdir(rust_project_dir, { recursive: true });
      }
      const project_cn_conf = path.join(npmDirectory, "src-tauri", "cn_config.bak");
      const project_conf = path.join(rust_project_dir, "config");
      fs.copyFile(project_cn_conf, project_conf);

      const _ = await shellExec(
        `cd "${npmDirectory}" && npm install --registry=https://registry.npmmirror.com && npm run build`
      );
    } else {
      const _ = await shellExec(`cd "${npmDirectory}" && npm install && npm run build`);
    }
    const language = tauriConf.tauri.bundle.windows.wix.language[0];
    const arch = process.arch;
    const msiName = `${name}_${tauriConf.package.version}_${arch}_${language}.msi`;
    const appPath = this.getBuildedAppPath(npmDirectory, msiName);
    const distPath = path.resolve(`${name}.msi`);
    await fs.copyFile(appPath, distPath);
    await fs.unlink(appPath);
    logger.success('Build success!');
    logger.success('You can find the app installer in', distPath);
  }

  getBuildedAppPath(npmDirectory: string, dmgName: string) {
    return path.join(
      npmDirectory,
      'src-tauri/target/release/bundle/msi',
      dmgName
    );
  }
}
