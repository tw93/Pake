import fs from 'fs/promises';
import path from 'path';
import prompts from 'prompts';
import { checkRustInstalled, installRust } from '@/helpers/rust.js';
import { PakeAppOptions } from '@/types.js';
import { IBuilder } from './base.js';
import { shellExec } from '@/utils/shell.js';
// @ts-expect-error 加上resolveJsonModule rollup会打包报错
// import tauriConf from '../../src-tauri/tauri.macos.conf.json';
import tauriConf from './tauriConf.js';
import log from 'loglevel';
import { mergeTauriConfig } from './common.js';
import { npmDirectory } from '@/utils/dir.js';
import logger from '@/options/logger.js';

export default class MacBuilder implements IBuilder {
  async prepare() {
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
      log.error('Error: Pake need Rust to package your webapp!');
      process.exit(2);
    }
  }

  async build(url: string, options: PakeAppOptions) {
    log.debug('PakeAppOptions', options);
    const { name } = options;

    await mergeTauriConfig(url, options, tauriConf);
    let dmgName: string;
    if (options.multiArch) {
      await shellExec(`cd "${npmDirectory}" && npm install --verbose && npm run build:mac`);
      dmgName = `${name}_${tauriConf.package.version}_universal.dmg`;
    } else {
      await shellExec(`cd "${npmDirectory}" && npm install --verbose && npm run build`);
      let arch  = "x64";
      if (process.arch === "arm64") {
        arch = "aarch64";
      } else {
        arch = process.arch;
      }
      dmgName = `${name}_${tauriConf.package.version}_${arch}.dmg`;
    }
    const appPath = this.getBuildAppPath(npmDirectory, dmgName, options.multiArch);
    const distPath = path.resolve(`${name}.dmg`);
    await fs.copyFile(appPath, distPath);
    await fs.unlink(appPath);

    logger.success('Build success!');
    logger.success('You can find the app installer in', distPath);
  }

  getBuildAppPath(npmDirectory: string, dmgName: string, multiArch: boolean) {
    let dmgPath: string;
    if (multiArch) {
      dmgPath = 'src-tauri/target/universal-apple-darwin/release/bundle/dmg';
    } else {
      dmgPath = 'src-tauri/target/release/bundle/dmg';
    }
    return path.join(npmDirectory, dmgPath, dmgName);
  }
}
