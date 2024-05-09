import chalk from 'chalk';
import { program, Option } from 'commander';
import log from 'loglevel';
import packageJson from '../package.json';
import BuilderProvider from './builders/BuilderProvider';
import { DEFAULT_PAKE_OPTIONS as DEFAULT } from './defaults';
import { checkUpdateTips } from './helpers/updater';
import handleInputOptions from './options/index';

import { PakeCliOptions } from './types';
import { validateNumberInput, validateUrlInput } from './utils/validate';

const { green, yellow } = chalk;
const logo = `${chalk.green(' ____       _')}
${green('|  _ \\ __ _| | _____')}
${green('| |_) / _` | |/ / _ \\')}
${green('|  __/ (_| |   <  __/')}  ${yellow('https://github.com/tw93/pake')}
${green('|_|   \\__,_|_|\\_\\___|  can turn any webpage into a desktop app with Rust.')}
`;

program
  .addHelpText('beforeAll', logo)
  .usage(`[url] [options]`)
  .showHelpAfterError();

program
  .argument('[url]', 'The web URL you want to package', validateUrlInput)
  .option('--name <string>', 'Application name')
  .option('--icon <string>', 'Application icon', DEFAULT.icon)
  .option('--width <number>', 'Window width', validateNumberInput, DEFAULT.width)
  .option('--height <number>', 'Window height', validateNumberInput, DEFAULT.height)
  .option('--transparent', 'Only for Mac, hide title bar', DEFAULT.transparent)
  .option('--fullscreen', 'Start in full screen', DEFAULT.fullscreen)
  .option('--show-system-tray', 'Show system tray in app', DEFAULT.showSystemTray)
  .option('--system-tray-icon <string>', 'Custom system tray icon', DEFAULT.systemTrayIcon)
  .option('--iter-copy-file', 'Copy files when URL is a local file', DEFAULT.iterCopyFile)
  .option('--multi-arch', 'Only for Mac, supports both Intel and M1', DEFAULT.multiArch)
  .option('--inject [injects...]', 'Injection of .js or .css Files', DEFAULT.inject)
  .option('--safe-domain [domains...]', 'Domains that Require Security Configuration"', DEFAULT.safeDomain)
  .option('--debug', 'Debug build and more output', DEFAULT.debug)
  .addOption(new Option('--user-agent <string>', 'Custom user agent').default(DEFAULT.userAgent).hideHelp())
  .addOption(new Option('--targets <string>', 'Only for Linux, option "deb" or "appimage"').default(DEFAULT.targets).hideHelp())
  .addOption(new Option('--always-on-top', 'Always on the top level').default(DEFAULT.alwaysOnTop).hideHelp())
  .addOption(new Option('--disabled-web-shortcuts', 'Disabled webPage shortcuts').default(DEFAULT.disabledWebShortcuts).hideHelp())
  .version(packageJson.version, '-v, --version', 'Output the current version')
  .action(async (url: string, options: PakeCliOptions) => {
    await checkUpdateTips();

    if (!url) {
      program.outputHelp(str => {
        return str
          .split('\n')
          .filter(line => !/((-h,|--help)|((-v|-V),|--version))\s+.+$/.test(line))
          .join('\n');
      });
      process.exit(0);
    }

    log.setDefaultLevel('info');
    if (options.debug) {
      log.setLevel('debug');
    }

    const appOptions = await handleInputOptions(options, url);
    log.debug('PakeAppOptions', appOptions);

    const builder = BuilderProvider.create(appOptions);
    await builder.prepare();
    await builder.build(url);
  });

program.parse();
