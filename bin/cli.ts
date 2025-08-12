import chalk from 'chalk';
import { program, Option } from 'commander';
import log from 'loglevel';
import packageJson from '../package.json';
import BuilderProvider from './builders/BuilderProvider';
import { DEFAULT_PAKE_OPTIONS as DEFAULT, DEFAULT_PAKE_OPTIONS } from './defaults';
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

program.addHelpText('beforeAll', logo).usage(`[url] [options]`).showHelpAfterError();

program
  .argument('[url]', 'The web URL you want to package', validateUrlInput)
  // Refer to https://github.com/tj/commander.js#custom-option-processing, turn string array into a string connected with custom connectors.
  // If the platform is Linux, use `-` as the connector, and convert all characters to lowercase.
  // For example, Google Translate will become google-translate.
  .option('--name <string...>', 'Application name', (value, previous) => {
    const platform = process.platform
    const connector = platform === 'linux' ? '-' : ' '
    const name = previous === undefined ? value : `${previous}${connector}${value}`
    
    return platform === 'linux' ? name.toLowerCase() : name
  })
  .option('--icon <string>', 'Application icon', DEFAULT.icon)
  .option('--width <number>', 'Window width', validateNumberInput, DEFAULT.width)
  .option('--height <number>', 'Window height', validateNumberInput, DEFAULT.height)
  .option('--use-local-file', 'Use local file packaging', DEFAULT.useLocalFile)
  .option('--fullscreen', 'Start in full screen', DEFAULT.fullscreen)
  .option('--hide-title-bar', 'For Mac, hide title bar', DEFAULT.hideTitleBar)
  .option('--multi-arch', 'For Mac, both Intel and M1', DEFAULT.multiArch)
  .option(
    '--inject <./style.css,./script.js,...>',
    'Injection of .js or .css files',
    (val, previous) => (val ? val.split(',').map(item => item.trim()) : DEFAULT.inject),
    DEFAULT.inject,
  )
  .option('--debug', 'Debug build and more output', DEFAULT.debug)
  .addOption(new Option('--proxy-url <url>', 'Proxy URL for all network requests').default(DEFAULT_PAKE_OPTIONS.proxyUrl).hideHelp())
  .addOption(new Option('--user-agent <string>', 'Custom user agent').default(DEFAULT.userAgent).hideHelp())
  .addOption(new Option('--targets <string>', 'For Linux, option "deb" or "appimage"').default(DEFAULT.targets).hideHelp())
  .addOption(new Option('--app-version <string>', 'App version, the same as package.json version').default(DEFAULT.appVersion).hideHelp())
  .addOption(new Option('--always-on-top', 'Always on the top level').default(DEFAULT.alwaysOnTop).hideHelp())
  .addOption(new Option('--dark-mode', 'Force Mac app to use dark mode').default(DEFAULT.darkMode).hideHelp())
  .addOption(new Option('--disabled-web-shortcuts', 'Disabled webPage shortcuts').default(DEFAULT.disabledWebShortcuts).hideHelp())
  .addOption(
    new Option('--activation-shortcut <string>', 'Shortcut key to active App').default(DEFAULT_PAKE_OPTIONS.activationShortcut).hideHelp(),
  )
  .addOption(new Option('--show-system-tray', 'Show system tray in app').default(DEFAULT.showSystemTray).hideHelp())
  .addOption(new Option('--system-tray-icon <string>', 'Custom system tray icon').default(DEFAULT.systemTrayIcon).hideHelp())
  .addOption(new Option('--installer-language <string>', 'Installer language').default(DEFAULT.installerLanguage).hideHelp())
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
