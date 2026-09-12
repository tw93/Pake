import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));
vi.mock('@/utils/shell', () => ({ shellExec: vi.fn() }));
vi.mock('@/utils/platform', () => ({
  IS_MAC: false,
  IS_WIN: false,
  IS_LINUX: true,
}));
vi.mock('@/builders/env', async (original) => ({
  ...(await original<object>()),
  detectPackageManager: vi.fn(async () => 'pnpm'),
  getBuildEnvironment: () => undefined,
}));
import LinuxBuilder from '@/builders/LinuxBuilder';
import { shellExec } from '@/utils/shell';
import { DEFAULT_PAKE_OPTIONS } from '@/defaults';
const realProcess = process;
beforeEach(() => {
  vi.stubGlobal('process', { ...realProcess, platform: 'linux' });
  vi.mocked(shellExec).mockReset().mockResolvedValue(0);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function fixture(targets = 'deb,appimage', debug = false) {
  const b = new LinuxBuilder({
    ...DEFAULT_PAKE_OPTIONS,
    name: 'Demo',
    targets,
    debug,
  } as any);
  const prepare = vi
    .spyOn(b as any, 'prepareBuild')
    .mockResolvedValue(undefined);
  const copy = vi
    .spyOn(b as any, 'copyBuildArtifacts')
    .mockResolvedValue(undefined);
  return { b, prepare, copy };
}
describe('Linux compile once and independent bundles', () => {
  it('compiles once then generates both installers without rewriting inputs', async () => {
    const { b, prepare, copy } = fixture();
    await b.build('https://example.com');
    expect(prepare).toHaveBeenCalledTimes(1);
    const commands = vi.mocked(shellExec).mock.calls.map(([c]) => c.args);
    expect(commands).toHaveLength(3);
    expect(commands[0]).toContain('--no-bundle');
    expect(
      commands
        .slice(1)
        .every((args) => args.includes('bundle') && !args.includes('build')),
    ).toBe(true);
    expect(copy.mock.calls.map((c) => c[0])).toEqual(['deb', 'appimage']);
  });
  it('does not bundle or copy after compilation fails', async () => {
    const { b, copy } = fixture();
    vi.mocked(shellExec).mockRejectedValue(new Error('compiler failed'));
    await expect(b.build('https://example.com')).rejects.toThrow(
      'compiler failed',
    );
    expect(shellExec).toHaveBeenCalledTimes(1);
    expect(copy).not.toHaveBeenCalled();
  });
  it('retries only AppImage bundling with NO_STRIP and preserves the successful DEB', async () => {
    const { b, copy } = fixture();
    let appImages = 0;
    vi.mocked(shellExec).mockImplementation(async (c) => {
      if (
        c.args.includes('bundle') &&
        c.args.includes('appimage') &&
        ++appImages === 1
      )
        throw Error('strip failed');
      return 0;
    });
    await b.build('https://example.com');
    expect(shellExec).toHaveBeenCalledTimes(4);
    expect(vi.mocked(shellExec).mock.calls[3][2]).toMatchObject({
      NO_STRIP: '1',
    });
    expect(copy.mock.calls.map((c) => c[0])).toEqual(['deb', 'appimage']);
  });
  it('continues after a DEB failure without compiling again', async () => {
    const { b, copy } = fixture();
    vi.mocked(shellExec).mockImplementation(async (c) => {
      if (c.args.includes('bundle') && c.args.includes('deb'))
        throw Error('deb failed');
      return 0;
    });
    await b.build('https://example.com');
    expect(shellExec).toHaveBeenCalledTimes(3);
    expect(copy.mock.calls.map((c) => c[0])).toEqual(['appimage']);
  });
  it('preserves target, features and debug settings in both stages', async () => {
    const { b } = fixture('deb,appimage-arm64', true);
    await b.build('https://example.com');
    for (const [c] of vi.mocked(shellExec).mock.calls) {
      expect(c.args).toContain('aarch64-unknown-linux-gnu');
      expect(c.args).toContain('cli-build');
    }
    expect(vi.mocked(shellExec).mock.calls[0][0].args).toContain('build:debug');
    expect(vi.mocked(shellExec).mock.calls[1][0].args).toContain('--debug');
  });
});
