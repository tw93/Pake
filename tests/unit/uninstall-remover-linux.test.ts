import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fsExtra from 'fs-extra';
import { execSync } from 'child_process';
import { getAppDataPaths } from '@/utils/app-data-paths';
import { shellExec } from '@/utils/shell';
import { generateLinuxPackageName } from '@/utils/name';
import {
  removeLinuxBinary,
  removeLinuxData,
} from '@/commands/uninstall/remover-linux';

vi.mock('@/utils/app-data-paths', () => ({
  getAppDataPaths: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/utils/shell', () => ({
  shellExec: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockedFsExtra = fsExtra as unknown as {
  pathExists: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const mockedExecSync = execSync as unknown as ReturnType<typeof vi.fn>;
const mockedShellExec = shellExec as unknown as ReturnType<typeof vi.fn>;
const mockedGetAppDataPaths = getAppDataPaths as unknown as ReturnType<
  typeof vi.fn
>;

describe('removeLinuxBinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFsExtra.pathExists.mockResolvedValue(true);
    mockedFsExtra.remove.mockResolvedValue(undefined);
    mockedShellExec.mockResolvedValue(0);
    mockedExecSync.mockImplementation(() => {
      throw new Error('command not found');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes dpkg for deb format', async () => {
    const target = {
      platform: 'linux' as const,
      format: 'deb' as const,
      output_path: '/home/you/pake-github.deb',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('GitHub', target);

    expect(mockedShellExec).toHaveBeenCalledWith(
      'sudo dpkg --remove pake-github',
    );
  });

  it('matches builder package name for names with dots', async () => {
    const target = {
      platform: 'linux' as const,
      format: 'deb' as const,
      output_path: '/home/you/pake-my-app.deb',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('My.App', target);

    expect(mockedShellExec).toHaveBeenCalledWith(
      `sudo dpkg --remove pake-${generateLinuxPackageName('My.App')}`,
    );
  });

  it('preserves CJK characters in package name to match builder output', async () => {
    const target = {
      platform: 'linux' as const,
      format: 'deb' as const,
      output_path: '/home/you/pake-我的应用.deb',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('我的应用', target);

    expect(mockedShellExec).toHaveBeenCalledWith(
      `sudo dpkg --remove pake-${generateLinuxPackageName('我的应用')}`,
    );
  });

  it('invokes rpm for rpm format', async () => {
    const target = {
      platform: 'linux' as const,
      format: 'rpm' as const,
      output_path: '/home/you/pake-github.rpm',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('GitHub', target);

    expect(mockedShellExec).toHaveBeenCalledWith(
      'sudo rpm --erase pake-github',
    );
  });

  it('aborts when dpkg removal fails', async () => {
    const error = new Error('dpkg failed');
    mockedShellExec.mockRejectedValue(error);
    const target = {
      platform: 'linux' as const,
      format: 'deb' as const,
      output_path: '/home/you/pake-github.deb',
      built_at: '2024-01-01T00:00:00Z',
    };

    await expect(removeLinuxBinary('GitHub', target)).rejects.toBe(error);
  });

  it('aborts when rpm removal fails', async () => {
    const error = new Error('rpm failed');
    mockedShellExec.mockRejectedValue(error);
    const target = {
      platform: 'linux' as const,
      format: 'rpm' as const,
      output_path: '/home/you/pake-github.rpm',
      built_at: '2024-01-01T00:00:00Z',
    };

    await expect(removeLinuxBinary('GitHub', target)).rejects.toBe(error);
  });

  it('invokes pacman for zst format when pacman exists', async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'command -v pacman >/dev/null 2>&1') return '';
      throw new Error('command not found');
    });
    const target = {
      platform: 'linux' as const,
      format: 'zst' as const,
      output_path: '/home/you/pake-github.zst',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('GitHub', target);

    expect(mockedShellExec).toHaveBeenCalledWith('sudo pacman -R pake-github');
  });

  it('warns and skips for zst format when pacman is missing', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('command not found');
    });
    const target = {
      platform: 'linux' as const,
      format: 'zst' as const,
      output_path: '/home/you/pake-github.zst',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('GitHub', target);

    expect(console.warn).toHaveBeenCalled();
    expect(mockedShellExec).not.toHaveBeenCalled();
  });

  it('aborts when pacman removal fails for zst format', async () => {
    const error = new Error('pacman failed');
    mockedShellExec.mockRejectedValue(error);
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'command -v pacman >/dev/null 2>&1') return '';
      throw new Error('command not found');
    });
    const target = {
      platform: 'linux' as const,
      format: 'zst' as const,
      output_path: '/home/you/pake-github.zst',
      built_at: '2024-01-01T00:00:00Z',
    };

    await expect(removeLinuxBinary('GitHub', target)).rejects.toBe(error);
  });

  it('removes output_path for appimage format', async () => {
    const target = {
      platform: 'linux' as const,
      format: 'appimage' as const,
      output_path: '/home/you/GitHub.AppImage',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('GitHub', target);

    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/home/you/GitHub.AppImage',
    );
  });

  it('warns and continues when appimage output_path is missing', async () => {
    mockedFsExtra.pathExists.mockResolvedValue(false);
    const target = {
      platform: 'linux' as const,
      format: 'appimage' as const,
      output_path: '/home/you/GitHub.AppImage',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeLinuxBinary('GitHub', target);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/home/you/GitHub.AppImage'),
    );
    expect(mockedFsExtra.remove).not.toHaveBeenCalled();
  });

  it('warns per-path but surfaces permission error to handler', async () => {
    mockedFsExtra.remove.mockRejectedValue(new Error('permission denied'));
    const target = {
      platform: 'linux' as const,
      format: 'raw' as const,
      output_path: '/home/you/pake-github',
      built_at: '2024-01-01T00:00:00Z',
    };

    await expect(removeLinuxBinary('GitHub', target)).rejects.toThrow(
      'permission denied',
    );
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('removeLinuxData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFsExtra.pathExists.mockResolvedValue(true);
    mockedFsExtra.remove.mockResolvedValue(undefined);
    mockedGetAppDataPaths.mockReturnValue({
      config: '/home/you/.config/GitHub',
      cache: '/home/you/.cache/GitHub',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes config and cache when both selected', async () => {
    await removeLinuxData('GitHub', { config: true, cache: true });

    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/home/you/.config/GitHub',
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/home/you/.cache/GitHub',
    );
  });

  it('removes only cache when config is not selected', async () => {
    await removeLinuxData('GitHub', { config: false, cache: true });

    expect(mockedFsExtra.remove).not.toHaveBeenCalledWith(
      '/home/you/.config/GitHub',
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      '/home/you/.cache/GitHub',
    );
  });
});
