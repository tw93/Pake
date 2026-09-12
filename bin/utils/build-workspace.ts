import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { setTimeout as delay } from 'timers/promises';
import { packageDirectory, setBuildDirectory } from './dir';
import logger from '@/options/logger';
import { PakeError } from './error';
import { hasReadyTauriCli } from './tauri-cli';

let cancellation:
  | { controller: AbortController; unsafeCleanup?: string }
  | undefined;

export function beginBuildCancellation(): () => void {
  const scope = { controller: new AbortController() };
  cancellation = scope;
  const cancel = (signal: NodeJS.Signals) =>
    scope.controller.abort(
      new PakeError(`Build cancelled (${signal}).`, { code: 'BUILD_FAILED' }),
    );
  const interrupt = () => cancel('SIGINT');
  const terminate = () => cancel('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  return () => {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    if (cancellation === scope) cancellation = undefined;
  };
}

export function getBuildCancellationSignal(): AbortSignal | undefined {
  return cancellation?.controller.signal;
}

export function preventBuildWorkspaceCleanup(reason: string): void {
  if (cancellation) cancellation.unsafeCleanup = reason;
}

export function throwIfBuildCancelled(): void {
  getBuildCancellationSignal()?.throwIfAborted();
}

/** Copy only build inputs; cached or previously generated user content is not a template. */
export async function createBuildWorkspace(sourceDirectory: string) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pake-build-'));
  try {
    for (const file of [
      'package.json',
      'pnpm-lock.yaml',
      'package-lock.json',
      'rust-toolchain.toml',
      'rust-toolchain',
    ]) {
      const source = path.join(sourceDirectory, file);
      if (await fs.pathExists(source))
        await fs.copy(source, path.join(directory, file));
    }
    const sourceTauri = path.join(sourceDirectory, 'src-tauri');
    await fs.copy(sourceTauri, path.join(directory, 'src-tauri'), {
      filter: (source) =>
        !['target', '.pake', 'gen'].includes(
          path.relative(sourceTauri, source).split(path.sep)[0],
        ),
    });
    await fs.ensureDir(path.join(directory, 'dist'));
    // Keep the CLI runnable while local input staging replaces this workspace's dist.
    await fs.copy(
      path.join(sourceDirectory, 'dist', 'cli.js'),
      path.join(directory, 'dist', 'cli.js'),
    );
    const modules = path.join(sourceDirectory, 'node_modules');
    if (await hasReadyTauriCli(sourceDirectory)) {
      await fs.symlink(
        modules,
        path.join(directory, 'node_modules'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    }
    return directory;
  } catch (error) {
    await fs.remove(directory);
    throw error;
  }
}

/** Hold the cache through artifact copying, beyond Cargo's own compile lock. */
export async function acquireBuildCache(
  targetDirectory: string,
): Promise<() => Promise<void>> {
  await fs.ensureDir(targetDirectory);
  const lock = path.join(targetDirectory, '.pake-build.lock');
  const started = Date.now();
  let announced = false;
  for (;;) {
    throwIfBuildCancelled();
    try {
      const handle = await fs.open(lock, 'wx');
      try {
        fs.writeFileSync(handle, String(process.pid));
      } finally {
        fs.closeSync(handle);
      }
      let released = false;
      return async () => {
        if (!released) {
          await fs.remove(lock);
          released = true;
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    try {
      const owner = Number(await fs.readFile(lock, 'utf8'));
      if (Number.isInteger(owner) && owner > 0) {
        try {
          process.kill(owner, 0);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
            // Read-then-unlink cannot atomically reclaim a dead owner's lock:
            // another waiter may already have acquired a new one at this path.
            throw new PakeError(
              'A previous Pake process left a compilation cache lock.',
              {
                code: 'BUILD_FAILED',
                hint: `After stopping other Pake builds, remove ${lock} and retry.`,
              },
            );
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    if (Date.now() - started > 900_000) {
      throw new PakeError(
        'Another Pake build is still using the compilation cache.',
        {
          code: 'BUILD_FAILED',
          hint: 'Wait for that build to finish, then retry.',
        },
      );
    }
    if (!announced) {
      logger.info(
        'Waiting for another Pake build to finish using the compilation cache...',
      );
      announced = true;
    }
    await delay(200);
  }
}

export async function enterBuildWorkspace() {
  const previousTarget = process.env.CARGO_TARGET_DIR;
  const targetDirectory = path.resolve(
    packageDirectory,
    previousTarget || 'src-tauri/target',
  );
  const directory = await createBuildWorkspace(packageDirectory);
  let release: (() => Promise<void>) | undefined;
  setBuildDirectory(directory);
  process.env.CARGO_TARGET_DIR = targetDirectory;
  const leave = async () => {
    setBuildDirectory(packageDirectory);
    if (previousTarget === undefined) delete process.env.CARGO_TARGET_DIR;
    else process.env.CARGO_TARGET_DIR = previousTarget;
    if (cancellation?.unsafeCleanup) {
      logger.warn(
        `Build processes could not be confirmed stopped; keeping workspace ${directory} and its cache lock: ${cancellation.unsafeCleanup}`,
      );
      return;
    }
    try {
      await fs.remove(directory);
    } catch (error) {
      logger.warn(
        `Could not remove the temporary build workspace ${directory}: ${String(error)}`,
      );
    } finally {
      try {
        await release?.();
      } catch (error) {
        logger.warn(
          `Could not release the compilation cache lock: ${String(error)}`,
        );
      }
    }
  };
  if (getBuildCancellationSignal()?.aborted) {
    await leave();
    throwIfBuildCancelled();
  }
  return Object.assign(leave, {
    async lockCache() {
      release = await acquireBuildCache(targetDirectory);
    },
  });
}
