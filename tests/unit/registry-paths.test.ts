import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRegistryDir, getRegistryPath } from '@/utils/registry-paths';

describe('registry-paths', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  function mockPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  function mockHome(home: string) {
    vi.spyOn(os, 'homedir').mockReturnValue(home);
  }

  it('resolves Linux registry directory to ~/.config/pake', () => {
    mockPlatform('linux');
    mockHome('/home/alice');

    expect(getRegistryDir()).toBe('/home/alice/.config/pake');
  });

  it('resolves macOS registry directory to ~/Library/Application Support/pake', () => {
    mockPlatform('darwin');
    mockHome('/Users/alice');

    expect(getRegistryDir()).toBe('/Users/alice/Library/Application Support/pake');
  });

  it('resolves Windows registry directory to %APPDATA%/pake', () => {
    mockPlatform('win32');
    vi.stubEnv('APPDATA', 'C:\\Users\\alice\\AppData\\Roaming');

    expect(getRegistryDir()).toBe('C:\\Users\\alice\\AppData\\Roaming\\pake');
  });

  it('resolves registry file path inside the registry directory', () => {
    mockPlatform('linux');
    mockHome('/home/alice');

    expect(getRegistryPath()).toBe(path.join('/home/alice/.config/pake', 'history.json'));
  });

  it('throws on unsupported platforms', () => {
    mockPlatform('freebsd');
    mockHome('/home/alice');

    expect(() => getRegistryDir()).toThrow('Unsupported platform');
  });
});
