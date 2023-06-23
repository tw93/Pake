import path from 'path';
import fsExtra from "fs-extra";
import prompts from 'prompts';

import { PakeAppOptions } from '@/types';
import { checkRustInstalled, installRust } from '@/helpers/rust';
import { mergeConfig } from "@/helpers/merge";
import tauriConfig from '@/helpers/tauriConfig';
import { npmDirectory } from '@/utils/dir';
import { getSpinner } from "@/utils/info";
import { shellExec } from '@/utils/shell';
import { isChinaDomain } from '@/utils/ip';
import { IS_MAC } from "@/utils/platform";
import logger from '@/options/logger';

export default abstract class BaseBuilder {
  protected options: PakeAppOptions;

  protected constructor(options: PakeAppOptions) {
    this.options = options;
  }

  async prepare() {
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
    const spinner = getSpinner('Installing package...');
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

  async build(url: string) {
    await this.buildAndCopy(url, this.options.targets);
  }

  async buildAndCopy(url: string, target: string) {
    const { name } = this.options;
    await mergeConfig(url, this.options, tauriConfig);

    // Build app
    const spinner = getSpinner('Building app...');
    setTimeout(() => spinner.stop(), 3000);
    await shellExec(`cd ${npmDirectory} && ${this.getBuildCommand()}`);

    // Copy app
    const fileName = this.getFileName();
    const fileType = this.getFileType(target);
    const appPath = this.getBuildAppPath(npmDirectory, fileName, fileType);
    const distPath = path.resolve(`${name}.${fileType}`);
    await fsExtra.copy(appPath, distPath);
    await fsExtra.remove(appPath);
    logger.success('✔ Build success!');
    logger.success('✔ App installer located in', distPath);
  }

  protected getFileType(target: string): string {
    return target.toLowerCase();
  }

  abstract getFileName(): string;

  protected getBuildCommand(): string {
    return "npm run build";
  }

  protected getBasePath(): string {
    return 'src-tauri/target/release/bundle/';
  }

  protected getBuildAppPath(npmDirectory: string, fileName: string, fileType: string): string {
    return path.join(
      npmDirectory,
      this.getBasePath(),
      fileType,
      `${fileName}.${fileType}`
    );
  }
}
