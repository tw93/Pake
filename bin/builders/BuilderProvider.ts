import BaseBuilder from './BaseBuilder';
import MacBuilder from './MacBuilder';
import WinBuilder from './WinBuilder';
import LinuxBuilder from './LinuxBuilder';

import { IS_MAC, IS_WIN, IS_LINUX } from '@/utils/platform';

export default class BuilderProvider {
  static create(): BaseBuilder {
    if (IS_MAC) {
      return new MacBuilder();
    }
    if (IS_WIN) {
      return new WinBuilder();
    }
    if (IS_LINUX) {
      return new LinuxBuilder();
    }
    throw new Error('The current system is not supported!');
  }
}
