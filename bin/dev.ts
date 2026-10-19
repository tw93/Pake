import log from 'loglevel';
import { PakeCliOptions } from './types';
import handleInputOptions from './options/index';
import BuilderProvider from './builders/BuilderProvider';
import { getCliProgram } from './helpers/cli-program';
import { restoreLocalTree } from './helpers/merge';

const program = getCliProgram();

program.action(async (url: string, options: PakeCliOptions) => {
  if (!url) {
    program.help({
      error: false,
    });
    return;
  }

  log.setDefaultLevel('debug');

  // The dev entry stages local input into the checkout's own dist/, which
  // Tauri embeds in every later build: heal a stranded run first and put the
  // original back when this one ends, fails or is interrupted.
  restoreLocalTree();
  for (const [signal, code] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const) {
    process.once(signal, () => {
      restoreLocalTree();
      process.exit(code);
    });
  }

  try {
    const appOptions = await handleInputOptions(options, url);
    log.debug('PakeAppOptions', appOptions);

    const builder = BuilderProvider.create(appOptions);
    await builder.prepare();
    await builder.start(url);
  } finally {
    restoreLocalTree();
  }
});

program.parse();
