import log from 'loglevel';
import { program } from 'commander';

import { PakeCliOptions } from './types';
import handleInputOptions from './options/index';
import BuilderProvider from './builders/BuilderProvider';
import { checkUpdateTips } from './helpers/updater';
import packageJson from '../package.json';
import { validateNumberInput, validateUrlInput } from './utils/validate';
import { DEFAULT_PAKE_OPTIONS as DEFAULT } from './defaults';

program
  .version(packageJson.version)
  .description('A CLI that can turn any webpage into a desktop app with Rust.')
  .showHelpAfterError();

program
  .argument('[url]', 'The web URL you want to package', validateUrlInput)
  .option('--name <string>', 'Application name')
  .option('--icon <string>', 'Application icon', DEFAULT.icon)
  .option('--height <number>', 'Window height', validateNumberInput, DEFAULT.height)
  .option('--width <number>', 'Window width', validateNumberInput, DEFAULT.width)
  .option('--no-resizable', 'Whether the window can be resizable', DEFAULT.resizable)
  .option('--fullscreen', 'Start the packaged app in full screen', DEFAULT.fullscreen)
  .option('--transparent', 'Transparent title bar', DEFAULT.transparent)
  .option('--user-agent <string>', 'Custom user agent', DEFAULT.userAgent)
  .option('--show-menu', 'Show menu in app', DEFAULT.showMenu)
  .option('--show-system-tray', 'Show system tray in app', DEFAULT.showSystemTray)
  .option('--system-tray-icon <string>', 'Custom system tray icon', DEFAULT.systemTrayIcon)
  .option('--iter-copy-file', 'Copy files to app when URL is a local file', DEFAULT.iterCopyFile)
  .option('--multi-arch', 'Available for Mac only, supports both Intel and M1', DEFAULT.multiArch)
  .option('--targets <string>', 'Only for Linux, option "deb", "appimage" or "all"', DEFAULT.targets)
  .option('--debug', 'Debug mode', DEFAULT.debug)
  .action(async (url: string, options: PakeCliOptions) => {

    //Check for update prompt
    await checkUpdateTips();

    // If no URL is provided, display help information
    if (!url) {
      program.help();
    }

    log.setDefaultLevel('info');
    if (options.debug) {
      log.setLevel('debug');
    }

    const builder = BuilderProvider.create();
    await builder.prepare();

    const appOptions = await handleInputOptions(options, url);

    log.debug('PakeAppOptions', appOptions);

    await builder.build(url, appOptions);
  });

program.parse();
