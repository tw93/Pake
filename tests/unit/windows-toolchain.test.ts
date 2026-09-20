import path from 'path';
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
