import path from 'path';
import fsExtra from 'fs-extra';
import chalk from 'chalk';
import prompts from 'prompts';

import { PakeAppOptions } from '@/types';
import { checkRustInstalled, installRust } from '@/helpers/rust';
import { mergeConfig } from '@/helpers/merge';
import tauriConfig from '@/helpers/tauriConfig';
import { npmDirectory } from '@/utils/dir';
import { getSpinner } from '@/utils/info';
import { shellExec } from '@/utils/shell';
import { isChinaDomain } from '@/utils/ip';
import { IS_MAC } from '@/utils/platform';
import logger from '@/options/logger';

export default abstract class BaseBuilder {
  protected options: PakeAppOptions;

  protected constructor(options: PakeAppOptions) {
    this.options = options;
  }

  async prepare() {
    const tauriSrcPath = path.join(npmDirectory, 'src-tauri');
    const tauriTargetPath = path.join(tauriSrcPath, 'target');
    const tauriTargetPathExists = await fsExtra.pathExists(tauriTargetPath);

    if (!IS_MAC && !tauriTargetPathExists) {
      logger.warn('✼ The first use requires installing system dependencies.');
      logger.warn('✼ See more in https://tauri.app/v1/guides/getting-started/prerequisites.');
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
        logger.error('✕ Rust required to package your webapp.');
        process.exit(0);
      }
    }

    const isChina = await isChinaDomain('www.npmjs.com');
    const spinner = getSpinner('Installing package...');
    const rustProjectDir = path.join(tauriSrcPath, '.cargo');
    const projectConf = path.join(rustProjectDir, 'config.toml');
    await fsExtra.ensureDir(rustProjectDir);

    if (isChina) {
      logger.info('✺ Located in China, using npm/rsProxy CN mirror.');
      const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');
      await fsExtra.copy(projectCnConf, projectConf);
      await shellExec(`cd "${npmDirectory}" && npm install --registry=https://registry.npmmirror.com`);
    } else {
      await shellExec(`cd "${npmDirectory}" && npm install`);
    }
    spinner.succeed(chalk.green('Package installed!'));
    if (!tauriTargetPathExists) {
      logger.warn('✼ The first packaging may be slow, please be patient and wait, it will be faster afterwards.');
    }
  }

  async build(url: string) {
    await this.buildAndCopy(url, this.options.targets);
  }

  async start(url: string) {
    await mergeConfig(url, this.options, tauriConfig);
  }

  async buildAndCopy(url: string, target: string) {
    const { name } = this.options;
    await mergeConfig(url, this.options, tauriConfig);

    // Build app
    const spinner = getSpinner('Building app...');
    setTimeout(() => spinner.stop(), 3000);
    await shellExec(`cd "${npmDirectory}" && ${this.getBuildCommand()}`);

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
    return target;
  }

  abstract getFileName(): string;

  protected getBuildCommand(): string {
    // the debug option should support `--debug` and `--release`
    return this.options.debug ? 'npm run build:debug' : 'npm run build';
  }

  protected getBasePath(): string {
    const basePath = this.options.debug ? 'debug' : 'release';
    return `src-tauri/target/${basePath}/bundle/`;
  }

  protected getBuildAppPath(npmDirectory: string, fileName: string, fileType: string): string {
    return path.join(npmDirectory, this.getBasePath(), fileType.toLowerCase(), `${fileName}.${fileType}`);
  }
}
