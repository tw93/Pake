import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fsExtra from 'fs-extra';
import { execSync } from 'child_process';
import { getAppDataPaths } from '@/utils/app-data-paths';
import { shellExec } from '@/utils/shell';
import {
  lookupWindowsProductCode,
  removeWindowsBinary,
  removeWindowsData,
} from '@/commands/uninstall/remover-windows';

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

describe('lookupWindowsProductCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ProductCode when DisplayName matches', () => {
    mockedExecSync.mockReturnValue(
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{12345678-1234-1234-1234-123456789012}\n    DisplayName    REG_SZ    GitHub\n',
    );

    const result = lookupWindowsProductCode('GitHub');

    expect(result).toBe('{12345678-1234-1234-1234-123456789012}');
  });

  it('returns undefined when no DisplayName matches', () => {
    mockedExecSync.mockReturnValue(
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{12345678-1234-1234-1234-123456789012}\n    DisplayName    REG_SZ    OtherApp\n',
    );

    const result = lookupWindowsProductCode('GitHub');

    expect(result).toBeUndefined();
  });
});

describe('removeWindowsBinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFsExtra.pathExists.mockResolvedValue(true);
    mockedFsExtra.remove.mockResolvedValue(undefined);
    mockedShellExec.mockResolvedValue(0);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes msiexec when ProductCode is found', async () => {
    mockedExecSync.mockReturnValue(
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{12345678-1234-1234-1234-123456789012}\n    DisplayName    REG_SZ    GitHub\n',
    );
    const target = {
      platform: 'windows' as const,
      format: 'msi' as const,
      output_path: 'C:\\Users\\you\\GitHub.msi',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeWindowsBinary('GitHub', target);

    expect(mockedShellExec).toHaveBeenCalledWith(
      'msiexec /x {12345678-1234-1234-1234-123456789012} /qn /norestart',
    );
    expect(mockedFsExtra.remove).not.toHaveBeenCalled();
  });

  it('removes output_path when ProductCode is not found', async () => {
    mockedExecSync.mockReturnValue('');
    const target = {
      platform: 'windows' as const,
      format: 'msi' as const,
      output_path: 'C:\\Users\\you\\GitHub.msi',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeWindowsBinary('GitHub', target);

    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      'C:\\Users\\you\\GitHub.msi',
    );
    expect(mockedShellExec).not.toHaveBeenCalled();
  });

  it('warns and continues when output_path is missing and no ProductCode', async () => {
    mockedExecSync.mockReturnValue('');
    mockedFsExtra.pathExists.mockResolvedValue(false);
    const target = {
      platform: 'windows' as const,
      format: 'msi' as const,
      output_path: 'C:\\Users\\you\\GitHub.msi',
      built_at: '2024-01-01T00:00:00Z',
    };

    await removeWindowsBinary('GitHub', target);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('C:\\Users\\you\\GitHub.msi'),
    );
    expect(mockedShellExec).not.toHaveBeenCalled();
    expect(mockedFsExtra.remove).not.toHaveBeenCalled();
  });
});

describe('removeWindowsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFsExtra.pathExists.mockResolvedValue(true);
    mockedFsExtra.remove.mockResolvedValue(undefined);
    mockedGetAppDataPaths.mockReturnValue({
      config: 'C:\\Users\\you\\AppData\\Roaming\\GitHub',
      cache: 'C:\\Users\\you\\AppData\\Local\\GitHub',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes config and cache when both categories are selected', async () => {
    await removeWindowsData('GitHub', { config: true, cache: true });

    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      'C:\\Users\\you\\AppData\\Roaming\\GitHub',
    );
    expect(mockedFsExtra.remove).toHaveBeenCalledWith(
      'C:\\Users\\you\\AppData\\Local\\GitHub',
    );
  });
});
