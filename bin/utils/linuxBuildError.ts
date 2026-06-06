const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

// Guidance printed after a Linux AppImage build fails for good. We cannot detect
// the exact cause: linuxdeploy streams its diagnostics to the terminal via
// `stdio: 'inherit'`, so they never reach `error.message` (which only holds the
// failed command line). We only reach here after NO_STRIP=1 has already been
// applied and still failed, so strip is presented as already ruled out.
const APPIMAGE_FAILURE_GUIDANCE =
  `\n\n${DIVIDER}\n` +
  'Linux AppImage Build Failed\n' +
  `${DIVIDER}\n\n` +
  'The AppImage bundler (linuxdeploy) failed. Common causes and fixes:\n\n' +
  '  • Strip incompatibility (glibc 2.38+): NO_STRIP=1 was already applied and\n' +
  '    the build still failed, so strip is likely not the cause.\n' +
  '  • Missing gdk-pixbuf loaders (e.g. "cannot stat\n' +
  "    '/usr/lib/gdk-pixbuf-2.0/...'\"): install them, then rebuild:\n" +
  '      Arch:    sudo pacman -S gdk-pixbuf2 librsvg\n' +
  '      Debian:  sudo apt install librsvg2-common gdk-pixbuf2.0-bin\n' +
  '      Fedora:  sudo dnf install gdk-pixbuf2-modules librsvg2\n' +
  '      then:    gdk-pixbuf-query-loaders --update-cache\n' +
  '  • Running in Docker/container: AppImage needs /dev/fuse:\n' +
  '      --privileged --device /dev/fuse --security-opt apparmor=unconfined\n\n' +
  'Still stuck? Build a DEB instead: pake <url> --targets deb\n' +
  'Detailed guide: https://github.com/tw93/Pake/blob/main/docs/faq.md\n' +
  DIVIDER;

/**
 * Returns the original error with AppImage guidance appended to its message,
 * preserving the stack. Used when a Linux AppImage build fails for good.
 */
export function appendAppImageGuidance(error: unknown): Error {
  const baseError = error instanceof Error ? error : new Error(String(error));
  baseError.message += APPIMAGE_FAILURE_GUIDANCE;
  return baseError;
}
