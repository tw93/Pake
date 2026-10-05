import os from 'os';
import path from 'path';
import fsExtra from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));
vi.mock('@/utils/shell', () => ({ shellExec: vi.fn() }));
vi.mock('@/utils/platform', async (original) => ({
  ...(await original<object>()),
  IS_MAC: false,
  IS_WIN: true,
  IS_LINUX: false,
}));

import BaseBuilder from '@/builders/BaseBuilder';
import WinBuilder from '@/builders/WinBuilder';
import { getWindowsGnuBuildEnvironment } from '@/builders/env';
import logger from '@/options/logger';
import { shellExec } from '@/utils/shell';
import { PakeAppOptions } from '@/types';

const makeWinBuilder = (targets: string, windowsToolchain?: 'msvc' | 'gnu') =>
  new WinBuilder({
    name: 'Demo',
    appVersion: '1.0.0',
    installerLanguage: 'en-US',
    targets,
    windowsToolchain,
  } as PakeAppOptions);

describe('WinBuilder toolchain target selection', () => {
  it('keeps the default msvc triples when windowsToolchain is not set', () => {
    expect((makeWinBuilder('x64') as any).getTauriTarget('x64')).toBe(
      'x86_64-pc-windows-msvc',
    );
    expect((makeWinBuilder('arm64') as any).getTauriTarget('arm64')).toBe(
      'aarch64-pc-windows-msvc',
    );
  });

  it('keeps the msvc triples when windowsToolchain is explicitly msvc', () => {
    expect((makeWinBuilder('x64', 'msvc') as any).getTauriTarget('x64')).toBe(
      'x86_64-pc-windows-msvc',
    );
  });

  it('maps x64 to the gnu triple when windowsToolchain is gnu', () => {
    const builder = makeWinBuilder('x64', 'gnu');
    expect((builder as any).getTauriTarget('x64')).toBe(
      'x86_64-pc-windows-gnu',
    );
  });

  it('has no gnu mapping for arm64, matching MSYS2/MinGW only shipping x86_64', () => {
    const builder = makeWinBuilder('arm64', 'gnu');
    expect((builder as any).getTauriTarget('arm64')).toBeNull();
  });

  it('throws the existing unsupported-architecture error for arm64+gnu', () => {
    const builder = makeWinBuilder('arm64', 'gnu');
    expect(() => (builder as any).getBuildCommand('pnpm')).toThrow(
      'Unsupported architecture: arm64 for Windows',
    );
  });

  it('routes the gnu triple through the real build command and bundle path', () => {
    const builder = makeWinBuilder('x64', 'gnu');
    const command = (builder as any).getBuildCommand('pnpm');
    expect(command.args).toContain('x86_64-pc-windows-gnu');

    const basePath = (builder as any).getBasePath();
    expect(basePath.split(path.sep)).toContain('x86_64-pc-windows-gnu');
  });
});

describe('getWindowsGnuBuildEnvironment', () => {
  const originalRustflags = process.env.RUSTFLAGS;
  const originalEncodedRustflags = process.env.CARGO_ENCODED_RUSTFLAGS;
  const originalRustupToolchain = process.env.RUSTUP_TOOLCHAIN;

  beforeEach(() => {
    delete process.env.CARGO_ENCODED_RUSTFLAGS;
  });

  afterEach(() => {
    if (originalRustflags === undefined) {
      delete process.env.RUSTFLAGS;
    } else {
      process.env.RUSTFLAGS = originalRustflags;
    }
    if (originalEncodedRustflags === undefined) {
      delete process.env.CARGO_ENCODED_RUSTFLAGS;
    } else {
      process.env.CARGO_ENCODED_RUSTFLAGS = originalEncodedRustflags;
    }
    if (originalRustupToolchain === undefined) {
      delete process.env.RUSTUP_TOOLCHAIN;
    } else {
      process.env.RUSTUP_TOOLCHAIN = originalRustupToolchain;
    }
  });

  it('sets the exclude-all-symbols flag and the gnu host toolchain when unset', () => {
    delete process.env.RUSTFLAGS;
    delete process.env.RUSTUP_TOOLCHAIN;
    expect(getWindowsGnuBuildEnvironment()).toEqual({
      RUSTFLAGS: '-C link-args=-Wl,--exclude-all-symbols',
      RUSTUP_TOOLCHAIN: 'stable-x86_64-pc-windows-gnu',
    });
  });

  it('appends to an existing RUSTFLAGS instead of overwriting it', () => {
    process.env.RUSTFLAGS = '-C target-cpu=native';
    delete process.env.RUSTUP_TOOLCHAIN;
    expect(getWindowsGnuBuildEnvironment()).toEqual({
      RUSTFLAGS: '-C target-cpu=native -C link-args=-Wl,--exclude-all-symbols',
      RUSTUP_TOOLCHAIN: 'stable-x86_64-pc-windows-gnu',
    });
  });

  it('keeps an explicit RUSTUP_TOOLCHAIN the user already set', () => {
    delete process.env.RUSTFLAGS;
    process.env.RUSTUP_TOOLCHAIN = '1.95.0-x86_64-pc-windows-gnu';
    expect(getWindowsGnuBuildEnvironment()).toEqual({
      RUSTFLAGS: '-C link-args=-Wl,--exclude-all-symbols',
      RUSTUP_TOOLCHAIN: '1.95.0-x86_64-pc-windows-gnu',
    });
  });

  it('appends to encoded flags without merging lower-priority RUSTFLAGS', () => {
    process.env.CARGO_ENCODED_RUSTFLAGS =
      '-C\x1flink-arg=C:/Path With Spaces/lib.a';
    process.env.RUSTFLAGS = '-C target-cpu=native';
    const env = getWindowsGnuBuildEnvironment();
    expect(env.CARGO_ENCODED_RUSTFLAGS).toBe(
      '-C\x1flink-arg=C:/Path With Spaces/lib.a\x1f-C\x1flink-args=-Wl,--exclude-all-symbols',
    );
    expect(env.RUSTFLAGS).toBeUndefined();
  });

  it('uses encoded flags even when the existing variable is empty', () => {
    process.env.CARGO_ENCODED_RUSTFLAGS = '';
    process.env.RUSTFLAGS = '-C target-cpu=native';
    const env = getWindowsGnuBuildEnvironment();
    expect(env.CARGO_ENCODED_RUSTFLAGS).toBe(
      '-C\x1flink-args=-Wl,--exclude-all-symbols',
    );
    expect(env.RUSTFLAGS).toBeUndefined();
  });
});

class TestBuilder extends BaseBuilder {
  getFileName(): string {
    return 'test-app';
  }
}

describe('BaseBuilder.runBuildCommand Windows GNU RUSTFLAGS injection', () => {
  const realProcess = process;

  beforeEach(() => {
    vi.mocked(shellExec).mockReset().mockResolvedValue(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('injects the exclude-all-symbols RUSTFLAGS on win32 when windowsToolchain is gnu', async () => {
    vi.stubGlobal('process', { ...realProcess, platform: 'win32' });
    delete process.env.RUSTFLAGS;
    const builder = new TestBuilder({
      debug: true,
      windowsToolchain: 'gnu',
    } as any);

    await (builder as any).runBuildCommand(
      { executable: 'pnpm', args: ['run', 'build:debug'] },
      'msi',
    );

    const env = vi.mocked(shellExec).mock.calls[0][2];
    expect(env).toMatchObject({
      RUSTFLAGS: '-C link-args=-Wl,--exclude-all-symbols',
    });
  });

  it('does not inject RUSTFLAGS when windowsToolchain is msvc (default)', async () => {
    vi.stubGlobal('process', { ...realProcess, platform: 'win32' });
    const builder = new TestBuilder({ debug: true } as any);

    await (builder as any).runBuildCommand(
      { executable: 'pnpm', args: ['run', 'build:debug'] },
      'msi',
    );

    const env = vi.mocked(shellExec).mock.calls[0][2];
    expect(env?.RUSTFLAGS).toBeUndefined();
  });

  it('does not inject RUSTFLAGS on other platforms even if windowsToolchain is gnu', async () => {
    vi.stubGlobal('process', { ...realProcess, platform: 'linux' });
    const builder = new TestBuilder({
      debug: true,
      windowsToolchain: 'gnu',
    } as any);

    await (builder as any).runBuildCommand(
      { executable: 'pnpm', args: ['run', 'build:debug'] },
      'deb',
    );

    const env = vi.mocked(shellExec).mock.calls[0][2];
    expect(env?.RUSTFLAGS).toBeUndefined();
  });
});

describe('WinBuilder raw binary WebView2Loader.dll', () => {
  const originalCargoTargetDir = process.env.CARGO_TARGET_DIR;
  const originalCwd = process.cwd();
  const tempDirs: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    if (originalCargoTargetDir === undefined) {
      delete process.env.CARGO_TARGET_DIR;
    } else {
      process.env.CARGO_TARGET_DIR = originalCargoTargetDir;
    }
    await Promise.all(tempDirs.splice(0).map((dir) => fsExtra.remove(dir)));
  });

  // Lays out a fake cargo target dir holding the raw binary (and optionally
  // the loader DLL) for the given triple, plus an empty output dir.
  async function createFixture(triple: string, withDll = true) {
    const tempDir = await fsExtra.mkdtemp(
      path.join(os.tmpdir(), 'pake-win-binary-'),
    );
    tempDirs.push(tempDir);
    const cargoTargetDir = path.join(tempDir, 'target');
    const releaseDir = path.join(cargoTargetDir, triple, 'release');
    const outDir = path.join(tempDir, 'out');
    await fsExtra.outputFile(path.join(releaseDir, 'pake-demo.exe'), 'exe');
    if (withDll) {
      await fsExtra.outputFile(
        path.join(releaseDir, 'WebView2Loader.dll'),
        'dll',
      );
    }
    await fsExtra.ensureDir(outDir);
    process.env.CARGO_TARGET_DIR = cargoTargetDir;
    return { releaseDir, outDir };
  }

  function makeBuilder(
    outDir: string,
    windowsToolchain: 'msvc' | 'gnu',
    extra: Partial<PakeAppOptions> = {},
  ) {
    const builder = new WinBuilder({
      name: 'Demo',
      appVersion: '1.0.0',
      installerLanguage: 'en-US',
      targets: 'x64',
      debug: false,
      windowsToolchain,
      ...extra,
    } as PakeAppOptions);
    vi.spyOn(builder as any, 'getRawBinaryPath').mockReturnValue(
      path.join(outDir, 'Demo.exe'),
    );
    return builder;
  }

  it('copies WebView2Loader.dll beside the raw binary for gnu', async () => {
    const { outDir } = await createFixture('x86_64-pc-windows-gnu');
    const builder = makeBuilder(outDir, 'gnu');

    await (builder as any).copyRawBinary(process.cwd(), 'Demo');

    expect(await fsExtra.pathExists(path.join(outDir, 'Demo.exe'))).toBe(true);
    expect(
      await fsExtra.readFile(path.join(outDir, 'WebView2Loader.dll'), 'utf8'),
    ).toBe('dll');
  });

  it('does not copy WebView2Loader.dll for msvc', async () => {
    const { outDir } = await createFixture('x86_64-pc-windows-msvc');
    const builder = makeBuilder(outDir, 'msvc');

    await (builder as any).copyRawBinary(process.cwd(), 'Demo');

    expect(await fsExtra.pathExists(path.join(outDir, 'Demo.exe'))).toBe(true);
    expect(
      await fsExtra.pathExists(path.join(outDir, 'WebView2Loader.dll')),
    ).toBe(false);
  });

  it('warns without throwing when the gnu build has no WebView2Loader.dll', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { outDir } = await createFixture('x86_64-pc-windows-gnu', false);
    const builder = makeBuilder(outDir, 'gnu');

    await expect(
      (builder as any).copyRawBinary(process.cwd(), 'Demo'),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('WebView2Loader.dll not found'),
    );
    expect(
      await fsExtra.pathExists(path.join(outDir, 'WebView2Loader.dll')),
    ).toBe(false);
  });

  it('records the DLL as an artifact after the binary with --keep-binary', async () => {
    const successSpy = vi.spyOn(logger, 'success').mockImplementation(() => {});
    const { releaseDir, outDir } = await createFixture('x86_64-pc-windows-gnu');
    await fsExtra.outputFile(
      path.join(releaseDir, 'bundle', 'msi', 'Demo_1.0.0_x64_en-US.msi'),
      'msi',
    );
    // copyBuildArtifacts writes the installer relative to the cwd.
    process.chdir(outDir);
    const builder = makeBuilder(outDir, 'gnu', { keepBinary: true });

    await (builder as any).copyBuildArtifacts('msi');

    const artifacts = builder.getArtifacts();
    expect(artifacts.map((artifact) => artifact.format)).toEqual([
      'msi',
      'binary',
      'dll',
    ]);
    expect(artifacts[2].path).toBe(path.join(outDir, 'WebView2Loader.dll'));
    expect(successSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('WebView2Loader.dll copied beside it'),
    );
  });
});
