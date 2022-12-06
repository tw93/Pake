import { IS_MAC, IS_WIN, IS_LINUX } from '@/utils/platform.js';
import { IBuilder } from './base.js';
import MacBuilder from './MacBuilder.js';
import WinBuilder from './WinBulider.js';
import LinuxBuilder from './LinuxBuilder.js';

export default class BuilderFactory {
  static create(): IBuilder {
    console.log("now platform is ", process.platform);
    if (IS_MAC) {
      return new MacBuilder();
    }
    if (IS_WIN) {
      return new WinBuilder();
    }
    if (IS_LINUX) {
      return new LinuxBuilder();
    }
    throw new Error('The current system does not support!!');
  }
}
