import chalk from 'chalk';
import { program, Option } from 'commander';
import packageJson from '../../package.json';
import { DEFAULT_PAKE_OPTIONS as DEFAULT } from '../defaults';
import { validateNumberInput, validateUrlInput } from '../utils/validate';

export function getCliProgram() {
  const { green, yellow } = chalk;
  const logo = `${chalk.green(' ____       _')}
${green('|  _ \\ __ _| | _____')}
${green('| |_) / _` | |/ / _ \\')}
${green('|  __/ (_| |   <  __/')}  ${yellow('https://github.com/tw93/pake')}
${green('|_|   \\__,_|_|\\_\\___|  can turn any webpage into a desktop app with Rust.')}
`;

  return program
    .addHelpText('beforeAll', logo)
    .usage(`[url] [options]`)
    .helpOption('-h, --help', 'Show all CLI options')
    .showHelpAfterError()
    .argument('[url]', 'The web URL you want to package', validateUrlInput)
    .option('--name <string>', 'Application name')
    .addOption(
      new Option(
        '--identifier <string>',
        'Application identifier / bundle ID',
      ).hideHelp(),
    )
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
    .option(
      '--use-local-file',
      'Use local file packaging',
      DEFAULT.useLocalFile,
    )
    .option('--fullscreen', 'Start in full screen', DEFAULT.fullscreen)
    .option('--hide-title-bar', 'For Mac, hide title bar', DEFAULT.hideTitleBar)
    .option(
      '--hide-window-decorations',
      'Hide native window decorations on Windows and Linux',
      DEFAULT.hideWindowDecorations,
    )
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
    .option(
      '--json',
      'Machine-readable output: logs to stderr, one JSON result on stdout',
      DEFAULT.json,
    )
    .option(
      '--config <path>',
      'Load options from a JSON config file (fields mirror CLI options, see schema/pake.schema.json)',
    )
    .addOption(
      new Option(
        '--proxy-url <url>',
        'Proxy URL for all network requests (http://, https://, socks5://)',
      )
        .default(DEFAULT.proxyUrl)
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
      new Option(
        '--dark-mode',
        'Force app to use dark mode (supports macOS, Windows, and Linux)',
      )
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
        .default(DEFAULT.activationShortcut)
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
      new Option(
        '--no-bundle',
        'Skip packaging, output only the raw executable (Linux; for RPM distros where the bundler aborts)',
      )
        .default(DEFAULT.bundle)
        .hideHelp(),
    )
    .addOption(
      new Option('--multi-instance', 'Allow multiple app instances')
        .default(DEFAULT.multiInstance)
        .hideHelp(),
    )
    .addOption(
      new Option(
        '--multi-window',
        'Allow opening multiple windows within one app instance',
      )
        .default(DEFAULT.multiWindow)
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
      ).default(DEFAULT.forceInternalNavigation),
    )
    .addOption(
      new Option(
        '--internal-url-regex <string>',
        'Regex pattern to match URLs that should be considered internal',
      ).default(DEFAULT.internalUrlRegex),
    )
    .addOption(
      new Option(
        '--safe-domain <domains>',
        'Comma-separated domains kept inside the app (e.g. SSO/workspace callbacks)',
      ).default(DEFAULT.safeDomain),
    )
    .addOption(
      new Option(
        '--enable-find',
        'Enable in-page Find UI with Cmd/Ctrl+F/G shortcuts',
      )
        .default(DEFAULT.enableFind)
        .hideHelp(),
    )
    .addOption(
      new Option('--installer-language <string>', 'Installer language')
        .default(DEFAULT.installerLanguage)
        .hideHelp(),
    )
    .addOption(
      new Option('--zoom <number>', 'Initial page zoom level (50-200)')
        .default(DEFAULT.zoom)
        .argParser((value) => {
          const zoom = Number(value);
          if (!Number.isInteger(zoom) || zoom < 50 || zoom > 200) {
            throw new Error('--zoom must be an integer between 50 and 200');
          }
          return zoom;
        })
        .hideHelp(),
    )
    .addOption(
      new Option('--min-width <number>', 'Minimum window width')
        .default(DEFAULT.minWidth)
        .argParser(validateNumberInput)
        .hideHelp(),
    )
    .addOption(
      new Option('--min-height <number>', 'Minimum window height')
        .default(DEFAULT.minHeight)
        .argParser(validateNumberInput)
        .hideHelp(),
    )
    .addOption(
      new Option(
        '--ignore-certificate-errors',
        'Ignore certificate errors (for self-signed certificates)',
      )
        .default(DEFAULT.ignoreCertificateErrors)
        .hideHelp(),
    )
    .addOption(
      new Option(
        '--iterative-build',
        'Turn on rapid build mode (app only, no dmg/deb/msi), good for debugging',
      )
        .default(DEFAULT.iterativeBuild)
        .hideHelp(),
    )
    .addOption(
      new Option(
        '--new-window',
        'Allow sites to open new windows (for auth flows, tabs, branches)',
      ).default(DEFAULT.newWindow),
    )
    .addOption(
      new Option(
        '--install',
        'Auto-install app to /Applications (macOS) after build and remove local bundle',
      )
        .default(DEFAULT.install)
        .hideHelp(),
    )
    .addOption(
      new Option('--camera', 'Request camera permission on macOS')
        .default(DEFAULT.camera)
        .hideHelp(),
    )
    .addOption(
      new Option('--microphone', 'Request microphone permission on macOS')
        .default(DEFAULT.microphone)
        .hideHelp(),
    )
    .version(packageJson.version, '-v, --version')
    .configureHelp({
      sortSubcommands: true,
      visibleOptions: (command) => {
        const options = [...command.options];
        const helpOption = (command as unknown as { _helpOption?: Option })
          ._helpOption;
        if (helpOption) {
          options.push(helpOption);
        }
        return options;
      },
      optionTerm: (option) => {
        return option.flags;
      },
      optionDescription: (option) => {
        return option.description;
      },
    });
}
