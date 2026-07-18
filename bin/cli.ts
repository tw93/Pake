import log from 'loglevel';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import packageJson from '../package.json';
import BuilderProvider from './builders/BuilderProvider';
import handleInputOptions from './options/index';
import { getCliProgram } from './helpers/cli-program';
import { loadConfigFile } from './helpers/config-file';
import { restoreLocalTree } from './helpers/merge';
import { isPakeError, PakeError } from './utils/error';
import { validateUrlInput } from './utils/validate';
import {
  ERROR_EXIT_CODES,
  PakeErrorCode,
  enableMachineMode,
  getCapturedWarnings,
  printJsonResult,
} from './utils/output';
import { PakeCliOptions } from './types';

const program = getCliProgram();

// Make commander throw instead of exiting so option/argument parse errors
// honor the exit-code contract (2 = invalid input) and still emit the JSON
// result object when --json was requested.
program.exitOverride();

function isCommanderExit(
  error: unknown,
): error is { code: string; exitCode: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('commander.')
  );
}

// Which stage the failure happened in decides the default error code; a
// PakeError carrying an explicit code always wins over the phase default.
type BuildPhase = 'input' | 'prepare' | 'build';

const PHASE_ERROR_CODES: Record<BuildPhase, PakeErrorCode> = {
  input: 'INVALID_INPUT',
  prepare: 'ENV_MISSING',
  build: 'BUILD_FAILED',
};

function classifyError(
  error: unknown,
  phase: BuildPhase,
): { code: PakeErrorCode; message: string; hint: string | null } {
  if (isPakeError(error)) {
    return {
      code: error.code ?? PHASE_ERROR_CODES[phase],
      message: error.message,
      hint: error.hint ?? null,
    };
  }
  if (error instanceof Error) {
    return {
      code: PHASE_ERROR_CODES[phase],
      message: error.message,
      hint: null,
    };
  }
  return {
    code: 'UNEXPECTED',
    message: `Unexpected error: ${String(error)}`,
    hint: null,
  };
}

async function checkUpdateTips() {
  updateNotifier({ pkg: packageJson, updateCheckInterval: 1000 * 60 }).notify({
    isGlobal: true,
  });
}

program.action(async (urlArg: string, options: PakeCliOptions) => {
  const jsonMode = Boolean(options.json);
  if (jsonMode) {
    enableMachineMode();
  }

  let phase: BuildPhase = 'input';
  let appName: string | null = null;
  let url = urlArg;

  try {
    // Heal a dist_bak stranded by an earlier crashed local-input run before
    // building, or this build would embed that run's staged files.
    restoreLocalTree();

    if (!jsonMode) {
      await checkUpdateTips();
    }

    // Config file fills in whatever the command line did not set explicitly:
    // CLI flag > config field > built-in default.
    if (options.config) {
      const validKeys = new Set(
        program.options.map((option) => option.attributeName()),
      );
      const loaded = await loadConfigFile(options.config, validKeys);
      for (const [key, value] of Object.entries(loaded.options)) {
        if (program.getOptionValueSource(key) !== 'cli') {
          (options as unknown as Record<string, unknown>)[key] = value;
        }
      }
      if (!url && loaded.url) {
        try {
          url = validateUrlInput(loaded.url);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new PakeError(`Invalid "url" in config file: ${detail}`, {
            code: 'INVALID_INPUT',
          });
        }
      }
    }

    if (!url) {
      if (jsonMode) {
        throw new PakeError('No URL or local path to package.', {
          code: 'INVALID_INPUT',
          hint: 'Pass a URL/path argument or a config file with a "url" field.',
        });
      }
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
    appName = appOptions.name ?? null;

    const builder = BuilderProvider.create(appOptions);
    phase = 'prepare';
    await builder.prepare();
    phase = 'build';
    await builder.build(url);

    if (jsonMode) {
      printJsonResult({
        ok: true,
        name: appName,
        platform: process.platform,
        arch: builder.getReportArch(),
        outputs: builder.getArtifacts(),
        warnings: getCapturedWarnings(),
        error: null,
      });
    }
  } catch (error) {
    // program.help() and --help/--version throw under exitOverride with
    // exitCode 0; a clean commander exit is not a failure.
    if (isCommanderExit(error) && error.exitCode === 0) {
      return;
    }

    const classified = classifyError(error, phase);

    if (jsonMode) {
      printJsonResult({
        ok: false,
        name: appName,
        platform: process.platform,
        arch: null,
        outputs: [],
        warnings: getCapturedWarnings(),
        error: classified,
      });
    } else if (isPakeError(error)) {
      console.error(chalk.red(classified.message));
      if (classified.hint) {
        console.error(chalk.yellow(`✼ ${classified.hint}`));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`✕ ${error.message}`));
      if (options?.debug && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(`✕ Unexpected error: ${String(error)}`));
    }

    // exitCode + natural exit instead of process.exit: lets the finally
    // restore run and guarantees the JSON result is flushed on piped stdout.
    process.exitCode = ERROR_EXIT_CODES[classified.code];
  } finally {
    // A local-input run replaces the package's own dist/ during staging; put
    // it back so the CLI stays intact and later builds cannot embed this
    // user's files.
    restoreLocalTree();
  }
});

program.parseAsync().catch((error: unknown) => {
  if (isCommanderExit(error)) {
    // --help / --version and friends exit clean; commander already printed.
    if (error.exitCode === 0) {
      return;
    }
    // Parse errors (unknown option, invalid argument, missing value) are
    // invalid input. Commander already printed the message to stderr; in
    // json mode also emit the machine-readable result on stdout.
    if (process.argv.includes('--json')) {
      printJsonResult({
        ok: false,
        name: null,
        platform: process.platform,
        arch: null,
        outputs: [],
        warnings: [],
        error: {
          code: 'INVALID_INPUT',
          message: error.message.trim(),
          hint: 'Run pake --help for the accepted options.',
        },
      });
    }
    process.exitCode = ERROR_EXIT_CODES.INVALID_INPUT;
    return;
  }
  if (error instanceof Error) {
    console.error(chalk.red(`✕ ${error.message}`));
  } else {
    console.error(chalk.red(`✕ Unexpected error: ${String(error)}`));
  }
  process.exitCode = 1;
});
