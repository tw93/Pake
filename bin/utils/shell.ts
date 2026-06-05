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

    // Provide targeted guidance for common Linux AppImage build failures.
    // A gtk-plugin / gdk-pixbuf failure also mentions linuxdeploy/appimage but
    // is unrelated to strip, so it must be matched first and given its own hint.
    const lowerError = errorMessage.toLowerCase();
    const divider =
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    if (process.platform === 'linux') {
      const isGtkPixbufFailure =
        lowerError.includes('gdk-pixbuf') ||
        lowerError.includes('failed to run plugin: gtk');
      const isAppImageStripFailure =
        lowerError.includes('linuxdeploy') ||
        lowerError.includes('appimage') ||
        lowerError.includes('strip');
      const noStripActive = !!(env?.NO_STRIP || process.env.NO_STRIP);

      if (isGtkPixbufFailure) {
        errorMsg +=
          `\n\n${divider}\n` +
          'Linux AppImage Build Failed\n' +
          `${divider}\n\n` +
          "Cause: linuxdeploy's gtk plugin could not find the gdk-pixbuf loaders\n" +
          '       (e.g. "cannot stat \'/usr/lib/gdk-pixbuf-2.0/...\'").\n\n' +
          'Quick fix:\n' +
          '  • Install the gdk-pixbuf loaders for your distro:\n' +
          '      Arch:    sudo pacman -S gdk-pixbuf2 librsvg\n' +
          '      Debian:  sudo apt install librsvg2-common gdk-pixbuf2.0-bin\n' +
          '      Fedora:  sudo dnf install gdk-pixbuf2-modules librsvg2\n' +
          '  • Refresh the loader cache, then rebuild:\n' +
          '      gdk-pixbuf-query-loaders --update-cache\n\n' +
          'Alternative:\n' +
          '  • Use DEB format instead: pake <url> --targets deb\n' +
          '  • Detailed guide: https://github.com/tw93/Pake/blob/main/docs/faq.md\n' +
          divider;
      } else if (isAppImageStripFailure) {
        errorMsg +=
          `\n\n${divider}\n` +
          'Linux AppImage Build Failed\n' +
          `${divider}\n\n` +
          'Cause: Strip tool incompatibility with glibc 2.38+\n' +
          '       (affects Debian Trixie, Arch Linux, and other modern distros)\n\n';

        errorMsg += noStripActive
          ? 'NO_STRIP=1 is already set but the build still failed, so this is\n' +
            'likely not a strip issue. Try the alternatives below or rerun with\n' +
            '--debug and read the linuxdeploy output above for the real cause.\n\n'
          : 'Quick fix:\n' +
            '  NO_STRIP=1 pake <url> --targets appimage --debug\n\n';

        errorMsg +=
          'Alternatives:\n' +
          '  • Use DEB format: pake <url> --targets deb\n' +
          '  • Update binutils: sudo apt install binutils (or pacman -S binutils)\n' +
          '  • Detailed guide: https://github.com/tw93/Pake/blob/main/docs/faq.md\n' +
          divider;

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
    }

    throw new Error(errorMsg);
  }
}
