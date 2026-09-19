import { afterEach, describe, expect, it, vi } from 'vitest';

const execaSyncMock = vi.hoisted(() => vi.fn());
const pathExistsSyncMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({ execaSync: execaSyncMock }));
vi.mock('fs-extra', () => ({
  default: { pathExistsSync: pathExistsSyncMock },
}));

import {
  hasWindowsGnuToolchain,
  hasWindowsMsvcBuildTools,
} from '@/helpers/rust';

describe('hasWindowsMsvcBuildTools', () => {
  afterEach(() => {
    execaSyncMock.mockReset();
    pathExistsSyncMock.mockReset();
    delete process.env['ProgramFiles(x86)'];
  });

  it('returns false when vswhere.exe is not present', () => {
    pathExistsSyncMock.mockReturnValue(false);

    expect(hasWindowsMsvcBuildTools()).toBe(false);
    expect(execaSyncMock).not.toHaveBeenCalled();
  });

  it('returns true when vswhere reports an installation with the VC tools component', () => {
    pathExistsSyncMock.mockReturnValue(true);
    execaSyncMock.mockReturnValue({
      stdout: 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
    });

    expect(hasWindowsMsvcBuildTools()).toBe(true);
  });

  it('returns false when vswhere finds no matching installation', () => {
    pathExistsSyncMock.mockReturnValue(true);
    execaSyncMock.mockReturnValue({ stdout: '   ' });

    expect(hasWindowsMsvcBuildTools()).toBe(false);
  });

  it('returns false when vswhere itself fails', () => {
    pathExistsSyncMock.mockReturnValue(true);
    execaSyncMock.mockImplementation(() => {
      throw new Error('vswhere crashed');
    });

    expect(hasWindowsMsvcBuildTools()).toBe(false);
  });
});

describe('hasWindowsGnuToolchain', () => {
  afterEach(() => {
    execaSyncMock.mockReset();
  });

  it('returns true when gcc is on PATH', () => {
    execaSyncMock.mockReturnValue({ stdout: '' });

    expect(hasWindowsGnuToolchain()).toBe(true);
    expect(execaSyncMock).toHaveBeenCalledWith('gcc', ['--version'], {
      stdio: 'ignore',
    });
  });

  it('returns false when gcc is not found', () => {
    execaSyncMock.mockImplementation(() => {
      throw new Error('not found');
    });

    expect(hasWindowsGnuToolchain()).toBe(false);
  });
});
