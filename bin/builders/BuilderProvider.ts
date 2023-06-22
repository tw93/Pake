import BaseBuilder from './BaseBuilder';
import MacBuilder from './MacBuilder';
import WinBuilder from './WinBuilder';
import LinuxBuilder from './LinuxBuilder';

const { platform } = process;

const buildersMap: Record<string, new () => BaseBuilder> = {
  darwin: MacBuilder,
  win32: WinBuilder,
  linux: LinuxBuilder,
};

export default class BuilderProvider {
  static create(): BaseBuilder {
    const Builder = buildersMap[platform];
    if (!Builder) {
      throw new Error('The current system is not supported!');
    }
    return new Builder();
  }
}
