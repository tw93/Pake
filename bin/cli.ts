import chalk from 'chalk';
import { program, Option } from 'commander';
import log from 'loglevel';
import packageJson from '../package.json';
import BuilderProvider from './builders/BuilderProvider';
import {
  DEFAULT_PAKE_OPTIONS as DEFAULT,
  DEFAULT_PAKE_OPTIONS,
} from './defaults';
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
  // Refer to https://github.com/tj/commander.js#custom-option-processing, turn string array into a string connected with custom connectors.
  // If the platform is Linux, use `-` as the connector, and convert all characters to lowercase.
  // For example, Google Translate will become google-translate.
  .option('--name <string>', 'Application name')
  .option('--icon <string>', 'Application icon', DEFAULT.icon)
  .option(
    '--width <number>',
    'Window width',
    validateNumberInput,
    DEFAULT.width,
  )
  .option(
    '--height <number>',
    'Window height',
    validateNumberInput,
    DEFAULT.height,
  )
  .option('--use-local-file', 'Use local file packaging', DEFAULT.useLocalFile)
  .option('--fullscreen', 'Start in full screen', DEFAULT.fullscreen)
  .option('--hide-title-bar', 'For Mac, hide title bar', DEFAULT.hideTitleBar)
  .option('--multi-arch', 'For Mac, both Intel and M1', DEFAULT.multiArch)
  .option(
    '--inject <files>',
    'Inject local CSS/JS files into the page',
    (val, previous) => {
      if (!val) return DEFAULT.inject;

      // Split by comma and trim whitespace, filter out empty strings
      const files = val
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      // If previous values exist (from multiple --inject options), merge them
      return previous ? [...previous, ...files] : files;
    },
    DEFAULT.inject,
  )
  .option('--debug', 'Debug build and more output', DEFAULT.debug)
  .addOption(
    new Option(
      '--proxy-url <url>',
      'Proxy URL for all network requests (http://, https://, socks5://)',
    )
      .default(DEFAULT_PAKE_OPTIONS.proxyUrl)
      .hideHelp(),
  )
  .addOption(
    new Option('--user-agent <string>', 'Custom user agent')
      .default(DEFAULT.userAgent)
      .hideHelp(),
  )
  .addOption(
    new Option(
      '--targets <string>',
      'Build target format for your system',
    ).default(DEFAULT.targets),
  )
  .addOption(
    new Option(
      '--app-version <string>',
      'App version, the same as package.json version',
    )
      .default(DEFAULT.appVersion)
      .hideHelp(),
  )
  .addOption(
    new Option('--always-on-top', 'Always on the top level')
      .default(DEFAULT.alwaysOnTop)
      .hideHelp(),
  )
  .addOption(
    new Option('--maximize', 'Start window maximized')
      .default(DEFAULT.maximize)
      .hideHelp(),
  )
  .addOption(
    new Option('--dark-mode', 'Force Mac app to use dark mode')
      .default(DEFAULT.darkMode)
      .hideHelp(),
  )
  .addOption(
    new Option('--disabled-web-shortcuts', 'Disabled webPage shortcuts')
      .default(DEFAULT.disabledWebShortcuts)
      .hideHelp(),
  )
  .addOption(
    new Option('--activation-shortcut <string>', 'Shortcut key to active App')
      .default(DEFAULT_PAKE_OPTIONS.activationShortcut)
      .hideHelp(),
  )
  .addOption(
    new Option('--show-system-tray', 'Show system tray in app')
      .default(DEFAULT.showSystemTray)
      .hideHelp(),
  )
  .addOption(
    new Option('--system-tray-icon <string>', 'Custom system tray icon')
      .default(DEFAULT.systemTrayIcon)
      .hideHelp(),
  )
  .addOption(
    new Option(
      '--hide-on-close [boolean]',
      'Hide window on close instead of exiting (default: true for macOS, false for others)',
    )
      .default(DEFAULT.hideOnClose)
      .argParser((value) => {
        if (value === undefined) return true; // --hide-on-close without value
        if (value === 'true') return true;
        if (value === 'false') return false;
        throw new Error('--hide-on-close must be true or false');
      })
      .hideHelp(),
  )
  .addOption(new Option('--title <string>', 'Window title').hideHelp())
  .addOption(
    new Option('--incognito', 'Launch app in incognito/private mode')
      .default(DEFAULT.incognito)
      .hideHelp(),
  )
  .addOption(
    new Option('--wasm', 'Enable WebAssembly support (Flutter Web, etc.)')
      .default(DEFAULT.wasm)
      .hideHelp(),
  )
  .addOption(
    new Option('--enable-drag-drop', 'Enable drag and drop functionality')
      .default(DEFAULT.enableDragDrop)
      .hideHelp(),
  )
  .addOption(
    new Option('--keep-binary', 'Keep raw binary file alongside installer')
      .default(DEFAULT.keepBinary)
      .hideHelp(),
  )
  .addOption(
    new Option('--multi-instance', 'Allow multiple app instances')
      .default(DEFAULT.multiInstance)
      .hideHelp(),
  )
  .addOption(
    new Option('--start-to-tray', 'Start app minimized to tray')
      .default(DEFAULT.startToTray)
      .hideHelp(),
  )
  .addOption(
    new Option(
      '--force-internal-navigation',
      'Keep every link inside the Pake window instead of opening external handlers',
    )
      .default(DEFAULT.forceInternalNavigation)
      .hideHelp(),
  )
  .addOption(
    new Option('--installer-language <string>', 'Installer language')
      .default(DEFAULT.installerLanguage)
      .hideHelp(),
  )
  .version(packageJson.version, '-v, --version')
  .configureHelp({
    sortSubcommands: true,
    optionTerm: (option) => {
      if (option.flags === '-v, --version' || option.flags === '-h, --help')
        return '';
      return option.flags;
    },
    optionDescription: (option) => {
      if (option.flags === '-v, --version' || option.flags === '-h, --help')
        return '';
      return option.description;
    },
  })
  .action(async (url: string, options: PakeCliOptions) => {
    await checkUpdateTips();

    if (!url) {
      program.help({
        error: false,
      });
      return;
    }

    log.setDefaultLevel('info');
    log.setLevel('info');
    if (options.debug) {
      log.setLevel('debug');
    }

    const appOptions = await handleInputOptions(options, url);

    const builder = BuilderProvider.create(appOptions);
    await builder.prepare();
    await builder.build(url);
  });

program.parse();
