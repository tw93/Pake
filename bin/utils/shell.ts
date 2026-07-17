import { execa } from 'execa';
import { npmDirectory } from './dir';
import { isMachineMode } from './output';

export async function shellExec(
  command: string,
  timeout: number = 300000,
  env?: Record<string, string>,
) {
  try {
    const { exitCode } = await execa(command, {
      cwd: npmDirectory,
      // Use 'inherit' to show all output directly to user in real-time.
      // This ensures linuxdeploy and other tool outputs are visible during builds.
      // In machine mode (--json) stdout is reserved for the final JSON result,
      // so subprocess stdout is rerouted to stderr instead.
      stdin: 'inherit',
      stdout: isMachineMode() ? process.stderr : 'inherit',
      stderr: 'inherit',
      shell: true,
      timeout,
      env: env ? { ...process.env, ...env } : process.env,
    });
    return exitCode;
  } catch (error: any) {
    const exitCode = error.exitCode ?? 'unknown';
    const errorMessage = error.message || 'Unknown error occurred';

    if (error.timedOut) {
      throw new Error(
        `Command timed out after ${timeout}ms: "${command}". Try increasing timeout or check network connectivity.`,
      );
    }

    // AppImage/linuxdeploy guidance is added by the caller (BaseBuilder), which
    // knows the build target. We only have the command line here (the tool's
    // diagnostics stream to the terminal via stdio:inherit, not into the error).
    throw new Error(
      `Error occurred while executing command "${command}". Exit code: ${exitCode}. Details: ${errorMessage}`,
    );
  }
}
