import { execa } from 'execa';
import { npmDirectory } from './dir';
import { isMachineMode } from './output';
import { setTimeout as delay } from 'timers/promises';
import {
  getBuildCancellationSignal,
  preventBuildWorkspaceCleanup,
} from './build-workspace';

export interface ShellCommand {
  executable: string;
  args: string[];
  cwd?: string;
}

async function terminateBuildTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await execa('taskkill', ['/pid', String(pid), '/T', '/F'], {
        timeout: 5000,
        windowsHide: true,
      });
    } catch (error) {
      // 128 is "process not found": a failed build has usually exited before
      // it rejects. Treating that as unconfirmed kept the cache lock, and
      // every later build refused to start until it was deleted by hand.
      if ((error as { exitCode?: number }).exitCode !== 128) throw error;
    }
    return;
  }

  const killGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  killGroup('SIGTERM');
  const started = Date.now();
  for (;;) {
    // The package manager can exit before its compiler descendants. Only
    // release the cache once no live member of their process group remains.
    // Zombies have already exited and cannot write artifacts.
    const { stdout } = await execa('ps', ['-axo', 'pgid=,stat='], {
      timeout: 1000,
    });
    const alive = stdout.split('\n').some((line) => {
      const [group, state] = line.trim().split(/\s+/);
      return Number(group) === pid && state && !state.startsWith('Z');
    });
    if (!alive) return;
    if (Date.now() - started > 5000)
      throw new Error('Build process group did not stop.');
    if (Date.now() - started >= 250) killGroup('SIGKILL');
    await delay(25);
  }
}

export async function shellExec(
  command: ShellCommand,
  timeout: number = 300000,
  env?: Record<string, string>,
) {
  const signal = getBuildCancellationSignal();
  signal?.throwIfAborted();
  try {
    const subprocess = execa(command.executable, command.args, {
      cwd: command.cwd ?? npmDirectory,
      // Use 'inherit' to show all output directly to user in real-time.
      // This ensures linuxdeploy and other tool outputs are visible during builds.
      // In machine mode (--json) stdout is reserved for the final JSON result,
      // so subprocess stdout is rerouted to stderr instead.
      stdin: 'inherit',
      stdout: isMachineMode() ? process.stderr : 'inherit',
      stderr: 'inherit',
      shell: false,
      detached: Boolean(signal) && process.platform !== 'win32',
      timeout,
      env: env ? { ...process.env, ...env } : process.env,
    });
    let termination: Promise<void> | undefined;
    const cancel = () => {
      if (termination || subprocess.pid === undefined) return;
      termination = terminateBuildTree(subprocess.pid).catch((error) => {
        preventBuildWorkspaceCleanup(String(error));
        subprocess.kill('SIGKILL');
      });
    };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    try {
      const { exitCode } = await subprocess;
      return exitCode;
    } catch (error) {
      // A timed-out or failed package manager can leave compiler descendants.
      // Use the same tree barrier before the caller releases its cache lock.
      if (signal) cancel();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      await termination;
      signal?.throwIfAborted();
    }
  } catch (error: any) {
    if (signal?.aborted) throw signal.reason;
    const description = JSON.stringify([command.executable, ...command.args]);
    const exitCode = error.exitCode ?? 'unknown';
    const errorMessage = error.message || 'Unknown error occurred';

    if (error.timedOut) {
      throw new Error(
        `Command timed out after ${timeout}ms: ${description}. Try increasing timeout or check network connectivity.`,
      );
    }

    // AppImage/linuxdeploy guidance is added by the caller (BaseBuilder), which
    // knows the build target. We only have the command line here (the tool's
    // diagnostics stream to the terminal via stdio:inherit, not into the error).
    throw new Error(
      `Error occurred while executing command ${description}. Exit code: ${exitCode}. Details: ${errorMessage}`,
    );
  }
}
