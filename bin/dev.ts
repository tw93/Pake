import log from 'loglevel';
import { DEFAULT_DEV_PAKE_OPTIONS } from './defaults';
import handleInputOptions from './options/index';
import BuilderProvider from './builders/BuilderProvider';

async function startBuild() {
  log.setDefaultLevel('debug');

  const appOptions = await handleInputOptions(DEFAULT_DEV_PAKE_OPTIONS, DEFAULT_DEV_PAKE_OPTIONS.url);
  log.debug('PakeAppOptions', appOptions);

  const builder = BuilderProvider.create(appOptions);
  await builder.prepare();
  await builder.start(DEFAULT_DEV_PAKE_OPTIONS.url);
}

startBuild();
