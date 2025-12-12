import log from 'loglevel';
import { PakeCliOptions } from './types';
import handleInputOptions from './options/index';
import BuilderProvider from './builders/BuilderProvider';
import { getCliProgram } from './helpers/cli-program';

const program = getCliProgram();

program.action(async (url: string, options: PakeCliOptions) => {
  log.setDefaultLevel('debug');

  const appOptions = await handleInputOptions(options, url);
  log.debug('PakeAppOptions', appOptions);

  const builder = BuilderProvider.create(appOptions);
  await builder.prepare();
  await builder.start(url);
});

program.parse();
