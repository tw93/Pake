import path from 'path';
import fsExtra from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));

import BaseBuilder from '@/builders/BaseBuilder';

class TestBuilder extends BaseBuilder {
  getFileName(): string {
    return 'test-app';
  }
}

describe('BaseBuilder guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prepends /usr/bin to PATH for macOS build environment', () => {
    const builder = new TestBuilder({} as any);
    const originalPath = process.env.PATH;
    process.env.PATH = '/opt/homebrew/bin:/usr/local/bin';

    try {
      const env = (builder as any).getBuildEnvironment();

      if (process.platform === 'darwin') {
        expect(env).toBeDefined();
        expect(env.PATH.startsWith('/usr/bin:')).toBe(true);
      } else {
        expect(env).toBeUndefined();
      }
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it('skips copy when source and destination are the same path', async () => {
    const builder = new TestBuilder({} as any);
    const copySpy = vi
      .spyOn(fsExtra, 'copy')
      .mockResolvedValue(undefined as any);

    await expect(
      (builder as any).copyFileWithSamePathGuard('/tmp/same', '/tmp/same'),
    ).resolves.toBeUndefined();
    expect(copySpy).not.toHaveBeenCalled();
  });

  it('suppresses same-path fs-extra copy errors', async () => {
    const builder = new TestBuilder({} as any);
    vi.spyOn(fsExtra, 'copy').mockRejectedValue(
      new Error('Source and destination must not be the same.'),
    );

    await expect(
      (builder as any).copyFileWithSamePathGuard('/tmp/a', '/tmp/b'),
    ).resolves.toBeUndefined();
  });

  it('rethrows non-same-path copy errors', async () => {
    const builder = new TestBuilder({} as any);
    vi.spyOn(fsExtra, 'copy').mockRejectedValue(new Error('permission denied'));

    await expect(
      (builder as any).copyFileWithSamePathGuard('/tmp/a', '/tmp/b'),
    ).rejects.toThrow('permission denied');
  });
});
