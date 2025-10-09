import { execa } from 'execa';
import { npmDirectory } from './dir';

export async function shellExec(
  command: string,
  timeout: number = 300000,
  env?: Record<string, string>,
) {
  try {
    const { exitCode } = await execa(command, {
      cwd: npmDirectory,
      stdio: ['inherit', 'pipe', 'inherit'], // Hide stdout verbose, keep stderr
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

    throw new Error(
      `Error occurred while executing command "${command}". Exit code: ${exitCode}. Details: ${errorMessage}`,
    );
  }
}
