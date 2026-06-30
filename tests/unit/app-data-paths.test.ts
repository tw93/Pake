import os from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAppDataPaths } from '@/utils/app-data-paths';

describe('app-data-paths', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  function mockPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  it('resolves Linux app data paths', () => {
    mockPlatform('linux');
    vi.spyOn(os, 'homedir').mockReturnValue('/home/alice');

    expect(getAppDataPaths('GitHub')).toEqual({
      config: '/home/alice/.config/GitHub',
      cache: '/home/alice/.cache/GitHub',
    });
  });

  it('resolves macOS app data paths', () => {
    mockPlatform('darwin');
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/alice');

    expect(getAppDataPaths('GitHub')).toEqual({
      config: '/Users/alice/Library/Application Support/GitHub',
      cache: '/Users/alice/Library/Caches/GitHub',
    });
  });

  it('resolves Windows app data paths', () => {
    mockPlatform('win32');
    vi.stubEnv('APPDATA', 'C:\\Users\\alice\\AppData\\Roaming');
    vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\alice\\AppData\\Local');

    expect(getAppDataPaths('GitHub')).toEqual({
      config: 'C:\\Users\\alice\\AppData\\Roaming\\GitHub',
      cache: 'C:\\Users\\alice\\AppData\\Local\\GitHub',
    });
  });

  it('throws on unsupported platforms', () => {
    mockPlatform('freebsd');
    vi.spyOn(os, 'homedir').mockReturnValue('/home/alice');

    expect(() => getAppDataPaths('GitHub')).toThrow('Unsupported platform');
  });
});
