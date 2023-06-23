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

  async buildAndCopy(url: string) {
    const { name } = this.options;
    await mergeConfig(url, this.options, tauriConfig);
    await this.runBuildCommand();

    const fileName = this.getFileName();
    const appPath = this.getBuildAppPath(npmDirectory, fileName);
    const distPath = path.resolve(`${name}.${this.getExtension()}`);
    await fsExtra.copy(appPath, distPath);
    await fsExtra.remove(appPath);
    logger.success('✔ Build success!');
    logger.success('✔ App installer located in', distPath);
  }

  abstract build(url: string): Promise<void>;

  abstract getFileName(): string;

  abstract getExtension(): string;

  protected getArch() {
    return process.arch === "x64" ? "amd64" : process.arch;
  }

  protected getBuildCommand(): string {
    return "npm run build";
  }

  protected runBuildCommand() {
    const spinner = getSpinner('Building app...');
    setTimeout(() => spinner.stop(), 3000);
    return shellExec(`cd ${npmDirectory} && ${this.getBuildCommand()}`);
  }

  protected getBasePath(): string {
    return 'src-tauri/target/release/bundle/';
  }

  protected getBuildAppPath(npmDirectory: string, fileName: string): string {
    return path.join(
      npmDirectory,
      this.getBasePath(),
      this.getExtension().toLowerCase(),
      `${fileName}.${this.getExtension()}`
    );
  }
}
