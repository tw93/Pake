import log from 'loglevel';
import BuilderProvider from './builders/BuilderProvider';
import { checkUpdateTips } from './helpers/updater';
import handleInputOptions from './options/index';
import { getCliProgram } from './helpers/cli-program';
import { PakeCliOptions } from './types';

const program = getCliProgram();

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
