import { describe, it, expect } from 'vitest';
import { detectLinuxPackageFamily } from '../../bin/utils/platform.js';

describe('detectLinuxPackageFamily', () => {
  it('detects Debian/Ubuntu families as deb', () => {
    expect(detectLinuxPackageFamily('ID=debian')).toBe('deb');
    expect(detectLinuxPackageFamily('ID=ubuntu\nID_LIKE=debian')).toBe('deb');
    expect(
      detectLinuxPackageFamily('ID=linuxmint\nID_LIKE="ubuntu debian"'),
    ).toBe('deb');
  });

  it('detects Fedora/RHEL families as rpm', () => {
    expect(detectLinuxPackageFamily('ID=fedora')).toBe('rpm');
    expect(detectLinuxPackageFamily('ID=rhel')).toBe('rpm');
    expect(
      detectLinuxPackageFamily('ID=rocky\nID_LIKE="rhel centos fedora"'),
    ).toBe('rpm');
  });

  it('detects Oracle Linux (ID=ol) as rpm', () => {
    expect(
      detectLinuxPackageFamily('ID="ol"\nID_LIKE="fedora"\nVERSION_ID="10.1"'),
    ).toBe('rpm');
  });

  it('detects openSUSE/SLES as rpm', () => {
    expect(
      detectLinuxPackageFamily('ID=opensuse-leap\nID_LIKE="suse opensuse"'),
    ).toBe('rpm');
    expect(detectLinuxPackageFamily('ID=sles')).toBe('rpm');
  });

  it('prefers the distro ID over ID_LIKE hints', () => {
    // A deb-based distro that lists no rpm hint stays deb.
    expect(detectLinuxPackageFamily('ID=ubuntu')).toBe('deb');
    // A distro whose own ID is rpm-based wins even with mixed-looking input.
    expect(detectLinuxPackageFamily('ID=fedora\nID_LIKE=')).toBe('rpm');
  });

  it('falls back to deb for unknown or empty os-release', () => {
    expect(detectLinuxPackageFamily('')).toBe('deb');
    expect(detectLinuxPackageFamily('ID=arch')).toBe('deb');
    expect(detectLinuxPackageFamily('# just a comment')).toBe('deb');
  });
});
