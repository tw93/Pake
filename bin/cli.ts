import { program } from 'commander';
import log from 'loglevel';
import { DEFAULT_PAKE_OPTIONS } from './defaults.js';
import { PakeCliOptions } from './types.js';
import { validateNumberInput, validateUrlInput } from './utils/validate.js';
import handleInputOptions from './options/index.js';
import BuilderFactory from './builders/BuilderFactory.js';
import { checkUpdateTips } from './helpers/updater.js';
// @ts-expect-error
import packageJson from '../package.json';

program.version(packageJson.version).description('A cli application can package a web page to desktop application.');

program
  .showHelpAfterError()
  .argument('[url]', 'the web url you want to package', validateUrlInput)
  .option('-n, --name <string>', 'application name')
  .option('-i, --icon <string>', 'application icon', DEFAULT_PAKE_OPTIONS.icon)
  .option('--height <number>', 'window height', validateNumberInput, DEFAULT_PAKE_OPTIONS.height)
  .option('-w, --width <number>', 'window width', validateNumberInput, DEFAULT_PAKE_OPTIONS.width)
  .option('--no-resizable', 'whether the window can be resizable', DEFAULT_PAKE_OPTIONS.resizable)
  .option('-f, --fullscreen', 'makes the packaged app start in full screen', DEFAULT_PAKE_OPTIONS.fullscreen)
  .option('-t, --transparent', 'transparent title bar', DEFAULT_PAKE_OPTIONS.transparent)
  .option('-d, --debug', 'debug', DEFAULT_PAKE_OPTIONS.debug)
  .option('-m, --multi-arch', "Supports both Intel and m1 chips, only for Mac.", DEFAULT_PAKE_OPTIONS.multi_arch)
  .action(async (url: string, options: PakeCliOptions) => {

    await checkUpdateTips();

    if (!url) {
      // 直接 pake 不需要出现url提示
      program.help();
    }

    log.setDefaultLevel('info');
    if (options.debug) {
      log.setLevel('debug');
    }

    const builder = BuilderFactory.create();
    await builder.prepare();

    const appOptions = await handleInputOptions(options, url);

    await builder.build(url, appOptions);
  });

program.parse();
