import os from 'os';
import path from 'path';
import fsExtra from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));

import BaseBuilder from '@/builders/BaseBuilder';
import logger from '@/options/logger';
import { CN_MIRROR_ENV, isCnMirrorEnabled } from '@/utils/mirror';

class TestBuilder extends BaseBuilder {
  getFileName(): string {
    return 'test-app';
  }
}

const originalCnMirrorEnv = process.env[CN_MIRROR_ENV];
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

describe('BaseBuilder guards', () => {
  afterEach(async () => {
    vi.restoreAllMocks();

    if (originalCnMirrorEnv === undefined) {
      delete process.env[CN_MIRROR_ENV];
    } else {
      process.env[CN_MIRROR_ENV] = originalCnMirrorEnv;
    }

    await Promise.all(tempDirs.splice(0).map((dir) => fsExtra.remove(dir)));
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
    const builder = new TestBuilder({} as any);
    const command = (builder as any).getInstallCommand('pnpm', false);

    expect(command).toContain('pnpm install');
    expect(command).not.toContain('registry.npmmirror.com');
  });

  it('uses npmmirror only when CN mirror is enabled', () => {
    const builder = new TestBuilder({} as any);
    const command = (builder as any).getInstallCommand('npm', true);

    expect(command).toContain(
      'npm install --registry=https://registry.npmmirror.com --legacy-peer-deps',
    );
  });

  it('copies Cargo mirror config only when CN mirror is enabled', async () => {
    const builder = new TestBuilder({} as any);
    const { tauriSrcPath, projectConf, projectCnConf } =
      await createCargoFixture();

    await (builder as any).configureCargoRegistry(tauriSrcPath, true);

    expect(await fsExtra.readFile(projectConf, 'utf8')).toBe(
      await fsExtra.readFile(projectCnConf, 'utf8'),
    );
  });

  it('removes generated Cargo mirror config when CN mirror is disabled', async () => {
    const builder = new TestBuilder({} as any);
    const { tauriSrcPath, projectConf } = await createCargoFixture(
      GENERATED_MIRROR_CONFIG,
    );

    await (builder as any).configureCargoRegistry(tauriSrcPath, false);

    expect(await fsExtra.pathExists(projectConf)).toBe(false);
  });

  it('keeps custom Cargo config when CN mirror is disabled', async () => {
    const builder = new TestBuilder({} as any);
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const customConfig = `${GENERATED_MIRROR_CONFIG}
# custom user setting
`;
    const { tauriSrcPath, projectConf } =
      await createCargoFixture(customConfig);

    await (builder as any).configureCargoRegistry(tauriSrcPath, false);

    expect(await fsExtra.readFile(projectConf, 'utf8')).toBe(customConfig);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('still references rsproxy.cn'),
    );
  });
});
