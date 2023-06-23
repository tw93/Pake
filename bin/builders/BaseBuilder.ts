import path from 'path';
import fsExtra from "fs-extra";
import prompts from 'prompts';

import logger from '@/options/logger';
import { shellExec } from '@/utils/shell';
import { isChinaDomain } from '@/utils/ip';
import { getSpinner } from "@/utils/info";
import { npmDirectory } from '@/utils/dir';
import { PakeAppOptions } from '@/types';
import { IS_MAC } from "@/utils/platform";
import { checkRustInstalled, installRust } from '@/helpers/rust';

export default abstract class BaseBuilder {
  abstract build(url: string, options: PakeAppOptions): Promise<void>;

  async prepare() {
    // Windows and Linux need to install necessary build tools.
    if (!IS_MAC) {
      logger.info('The first use requires installing system dependencies.');
      logger.info('See more in https://tauri.app/v1/guides/getting-started/prerequisites#installing.');
    }

    if (!checkRustInstalled()) {
      const res = await prompts({
        type: 'confirm',
        message: 'Rust not detected. Install now?',
        name: 'value',
      });

      if (res.value) {
        await installRust();
      } else {
        logger.error('Error: Rust required to package your webapp!');
        process.exit(0);
      }
    }

    const isChina = await isChinaDomain("www.npmjs.com");
    const spinner = getSpinner('Installing package.');
    if (isChina) {
      logger.info("Located in China, using npm/rsProxy CN mirror.");
      const rustProjectDir = path.join(npmDirectory, 'src-tauri', ".cargo");
      await fsExtra.ensureDir(rustProjectDir);
      const projectCnConf = path.join(npmDirectory, "src-tauri", "rust_proxy.toml");
      const projectConf = path.join(rustProjectDir, "config");
      await fsExtra.copy(projectCnConf, projectConf);
      await shellExec(`cd "${npmDirectory}" && npm install --registry=https://registry.npmmirror.com`);
    } else {
      await shellExec(`cd "${npmDirectory}" && npm install`);
    }
    spinner.succeed('Package installed.');
  }

  protected async runBuildCommand(command: string = "npm run build") {
    const spinner = getSpinner('Building app.');
    await shellExec(`cd "${npmDirectory}" && ${command}`);
    spinner.stop();
  }
}
