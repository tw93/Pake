import { execa } from 'execa';
import { npmDirectory } from './dir';

export async function shellExec(command: string) {
  try {
    const { exitCode } = await execa(command, {
      cwd: npmDirectory,
      stdio: 'inherit',
    });
    return exitCode;
  } catch (error) {
    throw new Error(
      `Error occurred while executing command "${command}". Exit code: ${error.exitCode}`,
    );
  }
}
