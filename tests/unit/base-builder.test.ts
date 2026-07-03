import os from 'os';
import path from 'path';
import fsExtra from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({
  execa: execaMock,
}));

vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));

import BaseBuilder from '@/builders/BaseBuilder';
import WinBuilder from '@/builders/WinBuilder';
import {
  _resetPackageManagerCache,
  configureCargoRegistry,
  detectPackageManager,
  getBuildEnvironment,
  getInstallCommand,
} from '@/builders/env';
import logger from '@/options/logger';
import { CN_MIRROR_ENV, isCnMirrorEnabled } from '@/utils/mirror';

class TestBuilder extends BaseBuilder {
  getFileName(): string {
    return 'test-app';
  }
}

const originalCnMirrorEnv = process.env[CN_MIRROR_ENV];
const originalCargoTargetDir = process.env.CARGO_TARGET_DIR;
const tempDirs: string[] = [];

const GENERATED_MIRROR_CONFIG = `[source.crates-io]
replace-with = 'rsproxy-sparse'
[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"
[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"
[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"
[net]
git-fetch-with-cli = true
`;

async function createCargoFixture(projectConfig?: string) {
  const tempDir = await fsExtra.mkdtemp(
    path.join(os.tmpdir(), 'pake-base-builder-'),
  );
  tempDirs.push(tempDir);

  const tauriSrcPath = path.join(tempDir, 'src-tauri');
  const projectConf = path.join(tauriSrcPath, '.cargo', 'config.toml');
  const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');

  await fsExtra.outputFile(projectCnConf, GENERATED_MIRROR_CONFIG);
  if (projectConfig !== undefined) {
    await fsExtra.outputFile(projectConf, projectConfig);
  }

  return { tauriSrcPath, projectConf, projectCnConf };
}

function mockPackageManagers(options: {
  pnpm?: string | Error;
  npm?: string | Error;
}) {
  execaMock.mockImplementation(async (command: string) => {
    const value = options[command as 'pnpm' | 'npm'];

    if (value instanceof Error) {
      throw value;
    }

    if (typeof value === 'string') {
      return { stdout: value };
    }

    throw new Error(`${command} not found`);
  });
}

describe('BaseBuilder guards', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    execaMock.mockReset();
    _resetPackageManagerCache();

    if (originalCnMirrorEnv === undefined) {
      delete process.env[CN_MIRROR_ENV];
    } else {
      process.env[CN_MIRROR_ENV] = originalCnMirrorEnv;
    }

    if (originalCargoTargetDir === undefined) {
      delete process.env.CARGO_TARGET_DIR;
    } else {
      process.env.CARGO_TARGET_DIR = originalCargoTargetDir;
    }

    await Promise.all(tempDirs.splice(0).map((dir) => fsExtra.remove(dir)));
  });

  it('prepends /usr/bin to PATH for macOS build environment', () => {
    const originalPath = process.env.PATH;
    process.env.PATH = '/opt/homebrew/bin:/usr/local/bin';

    try {
      const env = getBuildEnvironment();

      if (process.platform === 'darwin') {
        expect(env).toBeDefined();
        expect(env!.PATH.startsWith('/usr/bin:')).toBe(true);
      } else {
        expect(env).toBeUndefined();
      }
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it('skips Cargo registry copy when source and destination resolve to the same path', async () => {
    // configureCargoRegistry uses a same-path guard internally; if the
    // CN-mirror file and the project config end up identical we should not
    // crash with "source and destination must not be the same".
    const tempDir = await fsExtra.mkdtemp(
      path.join(os.tmpdir(), 'pake-base-builder-same-'),
    );
    tempDirs.push(tempDir);
    const tauriSrcPath = path.join(tempDir, 'src-tauri');
    const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');
    const projectConf = path.join(tauriSrcPath, '.cargo', 'config.toml');
    await fsExtra.outputFile(projectCnConf, GENERATED_MIRROR_CONFIG);
    await fsExtra.outputFile(projectConf, GENERATED_MIRROR_CONFIG);

    await expect(
      configureCargoRegistry(tauriSrcPath, true),
    ).resolves.toBeUndefined();
  });

  it('does not enable CN mirror by default', () => {
    delete process.env[CN_MIRROR_ENV];

    expect(isCnMirrorEnabled()).toBe(false);
    expect(isCnMirrorEnabled('false')).toBe(false);
    expect(isCnMirrorEnabled('0')).toBe(false);
  });

  it.each(['1', 'true', 'yes', 'on', ' TRUE '])(
    'enables CN mirror for %s',
    (value) => {
      process.env[CN_MIRROR_ENV] = value;

      expect(isCnMirrorEnabled()).toBe(true);
    },
  );

  it('uses official npm registry by default', () => {
    const command = getInstallCommand('pnpm', false);

    expect(command).toContain('pnpm install');
    expect(command).not.toContain('registry.npmmirror.com');
  });

  it('uses npmmirror only when CN mirror is enabled', () => {
    const command = getInstallCommand('npm', true);

    expect(command).toContain(
      'npm install --registry=https://registry.npmmirror.com --legacy-peer-deps',
    );
  });

  it('uses pnpm when the installed major matches the pinned package manager', async () => {
    mockPackageManagers({ pnpm: '10.26.2', npm: '11.12.1' });

    await expect(detectPackageManager()).resolves.toBe('pnpm');
    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock).toHaveBeenCalledWith('pnpm', ['--version']);
  });

  it('falls back to npm when the installed pnpm major does not match the pinned major', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    mockPackageManagers({ pnpm: '11.2.2', npm: '11.12.1' });

    await expect(detectPackageManager()).resolves.toBe('npm');
    expect(execaMock).toHaveBeenCalledWith('pnpm', ['--version']);
    expect(execaMock).toHaveBeenCalledWith('npm', ['--version'], {
      stdio: 'ignore',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('using npm for package management instead'),
    );
  });

  it('parses v-prefixed pnpm versions before comparing majors', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    mockPackageManagers({ pnpm: 'v11.2.2', npm: '11.12.1' });

    await expect(detectPackageManager()).resolves.toBe('npm');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Detected pnpm v11.2.2'),
    );
  });

  it('throws a clear error when pnpm is incompatible and npm is unavailable', async () => {
    mockPackageManagers({
      pnpm: '11.2.2',
      npm: new Error('missing npm'),
    });

    await expect(detectPackageManager()).rejects.toThrow(
      'Detected pnpm v11.2.2, but Pake is pinned to pnpm@10.26.2',
    );
    expect(execaMock).toHaveBeenCalledWith('npm', ['--version'], {
      stdio: 'ignore',
    });
  });

  it('falls back to npm when pnpm is unavailable', async () => {
    mockPackageManagers({ pnpm: new Error('missing pnpm'), npm: '11.12.1' });

    await expect(detectPackageManager()).resolves.toBe('npm');
  });

  it('throws when neither pnpm nor npm is available', async () => {
    mockPackageManagers({
      pnpm: new Error('missing pnpm'),
      npm: new Error('missing npm'),
    });

    await expect(detectPackageManager()).rejects.toThrow(
      'Neither pnpm nor npm is available',
    );
  });

  it('caches the detected package manager until reset', async () => {
    mockPackageManagers({ pnpm: '10.26.2' });

    await expect(detectPackageManager()).resolves.toBe('pnpm');
    mockPackageManagers({ pnpm: new Error('missing pnpm'), npm: '11.12.1' });
    await expect(detectPackageManager()).resolves.toBe('pnpm');
    expect(execaMock).toHaveBeenCalledTimes(1);

    _resetPackageManagerCache();
    await expect(detectPackageManager()).resolves.toBe('npm');
  });

  it('copies Cargo mirror config only when CN mirror is enabled', async () => {
    const { tauriSrcPath, projectConf, projectCnConf } =
      await createCargoFixture();

    await configureCargoRegistry(tauriSrcPath, true);

    expect(await fsExtra.readFile(projectConf, 'utf8')).toBe(
      await fsExtra.readFile(projectCnConf, 'utf8'),
    );
  });

  it('removes generated Cargo mirror config when CN mirror is disabled', async () => {
    const { tauriSrcPath, projectConf } = await createCargoFixture(
      GENERATED_MIRROR_CONFIG,
    );

    await configureCargoRegistry(tauriSrcPath, false);

    expect(await fsExtra.pathExists(projectConf)).toBe(false);
  });

  it('keeps custom Cargo config when CN mirror is disabled', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const customConfig = `${GENERATED_MIRROR_CONFIG}
# custom user setting
`;
    const { tauriSrcPath, projectConf } =
      await createCargoFixture(customConfig);

    await configureCargoRegistry(tauriSrcPath, false);

    expect(await fsExtra.readFile(projectConf, 'utf8')).toBe(customConfig);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('still references rsproxy.cn'),
    );
  });

  it('keeps the BaseBuilder hierarchy intact', () => {
    // Sanity check that subclasses can still construct against the slimmer
    // BaseBuilder after env helpers were extracted.
    const builder = new TestBuilder({} as any);
    expect(builder).toBeInstanceOf(BaseBuilder);
    expect(builder.getFileName()).toBe('test-app');
  });

  it('builds with generated .pake config and cli-build feature', () => {
    const builder = new TestBuilder({
      debug: false,
      targets: 'deb',
    } as any);

    const command = (builder as any).getBuildCommand('pnpm');
    const normalizedCommand = command.replace(/\\/g, '/');

    expect(normalizedCommand).toContain('src-tauri/.pake/tauri.conf.json');
    expect(command).toContain('--features cli-build');
  });

  it('copies Windows build artifacts from CARGO_TARGET_DIR when it is set', () => {
    const cargoTargetDir = path.join(process.cwd(), '.short-cargo-target');
    process.env.CARGO_TARGET_DIR = cargoTargetDir;

    const builder = new WinBuilder({
      debug: false,
      name: 'ChatGPT',
      targets: 'x64',
    } as any);

    const appPath = (builder as any).getBuildAppPath(
      process.cwd(),
      'ChatGPT_1.0.0_x64_en-US',
      'msi',
    );
    const binaryPath = (builder as any).getRawBinarySourcePath(
      process.cwd(),
      'ChatGPT',
    );

    expect(appPath).toBe(
      path.join(
        cargoTargetDir,
        'x86_64-pc-windows-msvc',
        'release',
        'bundle',
        'msi',
        'ChatGPT_1.0.0_x64_en-US.msi',
      ),
    );
    expect(binaryPath).toBe(
      path.join(
        cargoTargetDir,
        'x86_64-pc-windows-msvc',
        'release',
        'pake-chatgpt.exe',
      ),
    );
  });

  it('tracks generated Pake config files in the Cargo build script', async () => {
    const buildScript = await fsExtra.readFile(
      path.join(process.cwd(), 'src-tauri', 'build.rs'),
      'utf8',
    );

    expect(buildScript).toContain('cargo:rerun-if-changed=.pake/pake.json');
    expect(buildScript).toContain(
      'cargo:rerun-if-changed=.pake/tauri.conf.json',
    );
  });
});
