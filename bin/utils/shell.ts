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
      // Use 'inherit' to show all output directly to user in real-time.
      // This ensures linuxdeploy and other tool outputs are visible during builds.
      stdio: 'inherit',
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

    // Provide helpful guidance for common Linux AppImage build failures
    // caused by strip tool incompatibility with modern glibc (2.38+)
    const lowerError = errorMessage.toLowerCase();

    if (
      process.platform === 'linux' &&
      (lowerError.includes('linuxdeploy') ||
        lowerError.includes('appimage') ||
        lowerError.includes('strip'))
    ) {
      errorMsg +=
        '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'Linux AppImage Build Failed\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        'Cause: Strip tool incompatibility with glibc 2.38+\n' +
        '       (affects Debian Trixie, Arch Linux, and other modern distros)\n\n' +
        'Quick fix:\n' +
        '  NO_STRIP=1 pake <url> --targets appimage --debug\n\n' +
        'Alternatives:\n' +
        '  • Use DEB format: pake <url> --targets deb\n' +
        '  • Update binutils: sudo apt install binutils (or pacman -S binutils)\n' +
        '  • Detailed guide: https://github.com/tw93/Pake/blob/main/docs/faq.md\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

      if (
        lowerError.includes('fuse') ||
        lowerError.includes('operation not permitted') ||
        lowerError.includes('/dev/fuse')
      ) {
        errorMsg +=
          '\n\nDocker / Container hint:\n' +
          '  AppImage tooling needs access to /dev/fuse. When running inside Docker, add:\n' +
          '    --privileged --device /dev/fuse --security-opt apparmor=unconfined\n' +
          '  or run on the host directly.';
      }
    }

    throw new Error(errorMsg);
  }
}
