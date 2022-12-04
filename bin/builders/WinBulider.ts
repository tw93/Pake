import fs from 'fs/promises';
import path from 'path';
import prompts from 'prompts';
import { checkRustInstalled, installRust } from '@/helpers/rust.js';
import { PakeAppOptions } from '@/types.js';
import { IBuilder } from './base.js';
import { shellExec } from '@/utils/shell.js';
// @ts-expect-error 加上resolveJsonModule rollup会打包报错
import tauriConf from '../../src-tauri/tauri.conf.json';
import { fileURLToPath } from 'url';
import logger from '@/options/logger.js';
import { mergeTauriConfig } from './common.js';
import { npmDirectory } from '@/utils/dir.js';

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

    await mergeTauriConfig(url, options, tauriConf);

    const code = await shellExec(`cd ${npmDirectory} && npm run build:windows`);
    // const dmgName = `${name}_${tauriConf.package.version}_universal.dmg`;
    // const appPath = this.getBuildedAppPath(npmDirectory, dmgName);
    // await fs.copyFile(appPath, path.resolve(`${name}_universal.dmg`));
  }

  getBuildedAppPath(npmDirectory: string, dmgName: string) {
    return path.join(
      npmDirectory,
      'src-tauri/target/universal-apple-darwin/release/bundle/dmg',
      dmgName
    );
  }
}
