import { IS_MAC } from '@/utils/platform.js';
import { IBuilder } from './base.js';
import MacBuilder from './MacBuilder.js';
import WinBuilder from './WinBulider.js';

export default class BuilderFactory {
  static create(): IBuilder {
    if (IS_MAC) {
      return new MacBuilder();
    }
    throw new Error('The current system does not support');
  }
}
