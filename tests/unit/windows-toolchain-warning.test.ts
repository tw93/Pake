import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));
vi.mock('@/utils/tauri-cli', () => ({
  hasReadyTauriCli: vi.fn(async () => true),
}));
const rustHelperMocks = vi.hoisted(() => ({
  checkRustInstalled: vi.fn(() => true),
  ensureRustEnv: vi.fn(),
  installRust: vi.fn(),
  hasWindowsMsvcBuildTools: vi.fn(() => false),
  hasWindowsGnuToolchain: vi.fn(() => false),
}));
vi.mock('@/helpers/rust', () => rustHelperMocks);
vi.mock('@/utils/platform', async (original) => ({
  ...(await original<object>()),
  IS_MAC: false,
  IS_WIN: true,
  IS_LINUX: false,
}));

import BaseBuilder from '@/builders/BaseBuilder';
import logger from '@/options/logger';

class TestBuilder extends BaseBuilder {
  getFileName(): string {
    return 'test-app';
  }
}

describe('BaseBuilder.prepare() Windows toolchain hint', () => {
  const realProcess = process;

  beforeEach(() => {
    vi.stubGlobal('process', { ...realProcess, platform: 'win32' });
    rustHelperMocks.checkRustInstalled.mockReturnValue(true);
    rustHelperMocks.hasWindowsMsvcBuildTools.mockReturnValue(false);
    rustHelperMocks.hasWindowsGnuToolchain.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('warns when MSVC is missing, gnu is available, and no toolchain was requested', async () => {
    rustHelperMocks.hasWindowsGnuToolchain.mockReturnValue(true);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const builder = new TestBuilder({} as any);

    await builder.prepare();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('--windows-toolchain gnu'),
    );
  });

  it('does not warn when the user already requested gnu explicitly', async () => {
    rustHelperMocks.hasWindowsGnuToolchain.mockReturnValue(true);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const builder = new TestBuilder({ windowsToolchain: 'gnu' } as any);

    await builder.prepare();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('--windows-toolchain gnu'),
    );
  });

  it('does not warn when no gnu toolchain is available either', async () => {
    rustHelperMocks.hasWindowsGnuToolchain.mockReturnValue(false);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const builder = new TestBuilder({} as any);

    await builder.prepare();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('--windows-toolchain gnu'),
    );
  });

  it('does not warn when MSVC Build Tools are present', async () => {
    rustHelperMocks.hasWindowsMsvcBuildTools.mockReturnValue(true);
    rustHelperMocks.hasWindowsGnuToolchain.mockReturnValue(true);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const builder = new TestBuilder({} as any);

    await builder.prepare();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('--windows-toolchain gnu'),
    );
  });
});
