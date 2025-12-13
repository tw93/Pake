import log from 'loglevel';
import updateNotifier from 'update-notifier';
import packageJson from '../package.json';
import BuilderProvider from './builders/BuilderProvider';
import handleInputOptions from './options/index';
import { getCliProgram } from './helpers/cli-program';
import { PakeCliOptions } from './types';

const program = getCliProgram();

async function checkUpdateTips() {
  updateNotifier({ pkg: packageJson, updateCheckInterval: 1000 * 60 }).notify({
    isGlobal: true,
  });
}

program.action(async (url: string, options: PakeCliOptions) => {
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
