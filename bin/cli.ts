import log from 'loglevel';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import packageJson from '../package.json';
import BuilderProvider from './builders/BuilderProvider';
import handleInputOptions from './options/index';
import { getCliProgram } from './helpers/cli-program';
import { isPakeError } from './utils/error';
import { PakeCliOptions } from './types';

const program = getCliProgram();

async function checkUpdateTips() {
  updateNotifier({ pkg: packageJson, updateCheckInterval: 1000 * 60 }).notify({
    isGlobal: true,
  });
}

program.action(async (url: string, options: PakeCliOptions) => {
  try {
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
  } catch (error) {
    if (isPakeError(error)) {
      console.error(chalk.red(error.message));
    } else if (error instanceof Error) {
      console.error(chalk.red(`✕ ${error.message}`));
      if (options?.debug && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(`✕ Unexpected error: ${String(error)}`));
    }
    process.exit(1);
  }
});

program.parseAsync().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(chalk.red(`✕ ${error.message}`));
  } else {
    console.error(chalk.red(`✕ Unexpected error: ${String(error)}`));
  }
  process.exit(1);
});
