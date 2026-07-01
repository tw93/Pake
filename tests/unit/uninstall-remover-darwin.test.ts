import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fsExtra from 'fs-extra';
import { getAppDataPaths } from '@/utils/app-data-paths';
import {
  removeDarwinBinary,
  removeDarwinData,
} from '@/commands/uninstall/remover-darwin';

vi.mock('@/utils/app-data-paths', () => ({
  getAppDataPaths: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    remove: vi.fn(),
  },
}));

const mockedFsExtra = fsExtra as unknown as {
  pathExists: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const mockedGetAppDataPaths = getAppDataPaths as unknown as ReturnType<
  typeof vi.fn
>;

describe('removeDarwinBinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFsExtra.pathExists.mockResolvedValue(true);
    mockedFsExtra.remove.mockResolvedValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes install_path and output_path when both exist', async () => {
    const target = {
      platform: 'darwin' as const,
      format: 'dmg' as const,
      install_path: '/Applications/GitHub.app',
      output_path: '/Users/you/GitHub.dmg',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeDarwinBinary(target);

    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/Applications/GitHub.app',
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith('/Users/you/GitHub.dmg');
  });

  it('warns and continues when install_path is missing', async () => {
    mockedFsExtra.pathExists.mockImplementation(async (p: string) =>
      p !== '/Applications/GitHub.app' ? true : false,
    );
    const target = {
      platform: 'darwin' as const,
      format: 'dmg' as const,
      install_path: '/Applications/GitHub.app',
      output_path: '/Users/you/GitHub.dmg',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeDarwinBinary(target);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/Applications/GitHub.app'),
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith('/Users/you/GitHub.dmg');
    expect(mockedFsExtra.remove).not.toHaveBeenCalledWith(
      '/Applications/GitHub.app',
    );
  });

  it('warns and continues when output_path is missing', async () => {
    mockedFsExtra.pathExists.mockImplementation(async (p: string) =>
      p !== '/Users/you/GitHub.dmg' ? true : false,
    );
    const target = {
      platform: 'darwin' as const,
      format: 'dmg' as const,
      install_path: '/Applications/GitHub.app',
      output_path: '/Users/you/GitHub.dmg',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeDarwinBinary(target);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/Users/you/GitHub.dmg'),
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/Applications/GitHub.app',
    );
    expect(mockedFsExtra.remove).not.toHaveBeenCalledWith(
      '/Users/you/GitHub.dmg',
    );
  });

  it('warns for both paths when install_path and output_path are missing', async () => {
    mockedFsExtra.pathExists.mockResolvedValue(false);
    const target = {
      platform: 'darwin' as const,
      format: 'dmg' as const,
      install_path: '/Applications/GitHub.app',
      output_path: '/Users/you/GitHub.dmg',
      built_at: '2024-01-01T00:00:00Z',
    };

    await expect(removeDarwinBinary(target)).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/Applications/GitHub.app'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/Users/you/GitHub.dmg'),
    );
    expect(mockedFsExtra.remove).not.toHaveBeenCalled();
  });
});

describe('removeDarwinData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFsExtra.pathExists.mockResolvedValue(true);
    mockedFsExtra.remove.mockResolvedValue(undefined);
    mockedGetAppDataPaths.mockReturnValue({
      config: '/Users/you/Library/Application Support/GitHub',
      cache: '/Users/you/Library/Caches/GitHub',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes config and cache when both categories are selected', async () => {
    await removeDarwinData('GitHub', { config: true, cache: true });

    expect(mockedGetAppDataPaths).toHaveBeenCalledWith('GitHub');
    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/Users/you/Library/Application Support/GitHub',
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/Users/you/Library/Caches/GitHub',
    );
  });

  it('removes only cache when config is not selected', async () => {
    await removeDarwinData('GitHub', { config: false, cache: true });

    expect(mockedFsExtra.remove).not.toHaveBeenCalledWith(
      '/Users/you/Library/Application Support/GitHub',
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/Users/you/Library/Caches/GitHub',
    );
  });
});
