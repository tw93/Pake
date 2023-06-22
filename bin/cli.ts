import log from 'loglevel';
import { program } from 'commander';

import { PakeCliOptions } from './types';
import handleInputOptions from './options/index';
import BuilderProvider from './builders/BuilderProvider';
import { checkUpdateTips } from './helpers/updater';
import packageJson from '../package.json';
import { validateNumberInput, validateUrlInput } from './utils/validate';
import { DEFAULT_PAKE_OPTIONS } from './defaults';

program
  .version(packageJson.version)
  .description('A CLI that can turn any webpage into a desktop app with Rust.')
  .showHelpAfterError();

program
  .argument('[url]', 'The web URL you want to package', validateUrlInput)
  .option('--name <string>', 'Application name')
  .option('--icon <string>', 'Application icon', DEFAULT_PAKE_OPTIONS.icon)
  .option('--height <number>', 'Window height', validateNumberInput, DEFAULT_PAKE_OPTIONS.height)
  .option('--width <number>', 'Window width', validateNumberInput, DEFAULT_PAKE_OPTIONS.width)
  .option('--no-resizable', 'Whether the window can be resizable', DEFAULT_PAKE_OPTIONS.resizable)
  .option('--fullscreen', 'Start the packaged app in full screen', DEFAULT_PAKE_OPTIONS.fullscreen)
  .option('--transparent', 'Transparent title bar', DEFAULT_PAKE_OPTIONS.transparent)
  .option('--user-agent <string>', 'Custom user agent', DEFAULT_PAKE_OPTIONS.userAgent)
  .option('--show-menu', 'Show menu in app', DEFAULT_PAKE_OPTIONS.showMenu)
  .option('--show-system-tray', 'Show system tray in app', DEFAULT_PAKE_OPTIONS.showSystemTray)
  .option('--system-tray-icon <string>', 'Custom system tray icon', DEFAULT_PAKE_OPTIONS.systemTrayIcon)
  .option('--iter-copy-file', 'Copy all static files to pake app when URL is a local file', DEFAULT_PAKE_OPTIONS.iterCopyFile)
  .option('--multi-arch', 'Available for Mac only, supports both Intel and M1', DEFAULT_PAKE_OPTIONS.multiArch)
  .option('--targets <string>', 'Only for Linux, option "deb", "appimage" or "all"', DEFAULT_PAKE_OPTIONS.targets)
  .option('--debug', 'Debug mode', DEFAULT_PAKE_OPTIONS.debug)
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
