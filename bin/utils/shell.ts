import { execa } from 'execa';
import { npmDirectory } from './dir';

export async function shellExec(command: string) {
  try {
    const { exitCode } = await execa(command, {
      cwd: npmDirectory,
      stdio: 'inherit',
      shell: true,
    });
    return exitCode;
  } catch (error: any) {
    const exitCode = error.exitCode ?? 'unknown';
    const errorMessage = error.message || 'Unknown error occurred';
    throw new Error(
      `Error occurred while executing command "${command}". Exit code: ${exitCode}. Details: ${errorMessage}`,
    );
  }
}
