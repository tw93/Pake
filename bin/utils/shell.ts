import { execa } from 'execa';
import { npmDirectory } from './dir';

export async function shellExec(
  command: string,
  timeout: number = 300000,
  env?: Record<string, string>,
  showOutput: boolean = false,
) {
  try {
    const { exitCode } = await execa(command, {
      cwd: npmDirectory,
      stdio: showOutput ? 'inherit' : ['inherit', 'pipe', 'inherit'],
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

    let errorMsg = `Error occurred while executing command "${command}". Exit code: ${exitCode}. Details: ${errorMessage}`;

    if (
      process.platform === 'linux' &&
      (errorMessage.includes('linuxdeploy') ||
        errorMessage.includes('appimage') ||
        errorMessage.includes('strip'))
    ) {
      errorMsg +=
        '\n\nLinux AppImage build error. Try one of these solutions:\n' +
        '  1. Run with: NO_STRIP=true pake <url> --targets appimage\n' +
        '  2. Use DEB format instead: pake <url> --targets deb\n' +
        '  3. See detailed solutions: https://github.com/tw93/Pake/blob/main/docs/faq.md';
    }

    throw new Error(errorMsg);
  }
}
