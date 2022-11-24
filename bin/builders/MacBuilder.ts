import fs from 'fs/promises';
import path from 'path';
import prompts from 'prompts';
import { checkRustInstalled, installRust } from '@/helpers/rust.js';
import { PakeAppOptions } from '@/types.js';
import { IBuilder } from './base.js';
import { shellExec } from '@/utils/shell.js';
import tauriConf from '../../src-tauri/tauri.conf.json';
import { fileURLToPath } from 'url';
import log from 'loglevel';

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
      log.error('Error: Pake need Rust to package your webapp!!!');
      process.exit(2);
    }
  }

  async build(url: string, options: PakeAppOptions) {
    log.debug('PakeAppOptions', options);

    const { width, height, fullscreen, transparent, resizable, identifier, name } = options;

    const tauriConfWindowOptions = {
      width,
      height,
      fullscreen,
      transparent,
      resizable,
    };

    // TODO 下面这块逻辑还可以再拆 目前比较简单
    Object.assign(tauriConf.tauri.windows[0], { url, ...tauriConfWindowOptions });
    tauriConf.package.productName = name;
    tauriConf.tauri.bundle.identifier = identifier;
    tauriConf.tauri.bundle.icon = [options.icon];

    const npmDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const configJsonPath = path.join(npmDirectory, 'src-tauri/tauri.conf.json');
    await fs.writeFile(configJsonPath, Buffer.from(JSON.stringify(tauriConf), 'utf-8'));

    const code = await shellExec(`cd ${npmDirectory} && npm run build`);
    const dmgName = `${name}_${'0.2.0'}_universal.dmg`;
    const appPath = this.getBuildedAppPath(npmDirectory, dmgName);
    await fs.copyFile(appPath, path.resolve(`${name}_universal.dmg`));
  }

  getBuildedAppPath(npmDirectory: string, dmgName: string) {
    return path.join(npmDirectory, 'src-tauri/target/universal-apple-darwin/release/bundle/dmg', dmgName);
  }
}
