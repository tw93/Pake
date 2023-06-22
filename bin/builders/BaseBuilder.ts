import path from 'path';
import fsExtra from "fs-extra";
import prompts from 'prompts';

import { shellExec } from '@/utils/shell';
import { isChinaDomain } from '@/utils/ip';
import logger from '@/options/logger';
import { checkRustInstalled, installRust } from '@/helpers/rust';
import { PakeAppOptions } from '@/types';
import { IS_MAC } from "@/utils/platform";

export default abstract class BaseBuilder {
  abstract build(url: string, options: PakeAppOptions): Promise<void>;

  async prepare() {

    // Windows and Linux need to install necessary build tools.
    if (!IS_MAC) {
      logger.info('Install Rust and required build tools to build the app.');
      logger.info('See more in https://tauri.app/v1/guides/getting-started/prerequisites#installing.');
    }

    if (checkRustInstalled()) {
      return;
    }

    const res = await prompts({
      type: 'confirm',
      message: 'Rust not detected. Install now?',
      name: 'value',
    });

    if (res.value) {
      await installRust();
    } else {
      logger.error('Error: Rust required to package your webapp!');
      process.exit(2);
    }
  }

  protected async runBuildCommand(directory: string, command: string) {
    const isChina = await isChinaDomain("www.npmjs.com");
    if (isChina) {
      logger.info("Located in China, using npm/Rust CN mirror.");
      const rustProjectDir = path.join(directory, 'src-tauri', ".cargo");
      await fsExtra.ensureDir(rustProjectDir);
      const projectCnConf = path.join(directory, "src-tauri", "rust_proxy.toml");
      const projectConf = path.join(rustProjectDir, "config");
      await fsExtra.copy(projectCnConf, projectConf);

      await shellExec(`cd "${directory}" && npm install --registry=https://registry.npmmirror.com && ${command}`);
    } else {
      await shellExec(`cd "${directory}" && npm install && ${command}`);
    }
  }
}
