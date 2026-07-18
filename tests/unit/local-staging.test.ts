import path from 'path';
import os from 'os';
import fs from 'fs';
import fsExtra from 'fs-extra';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// stageLocalTree mutates the package's own dist/, so these tests point
// npmDirectory at a throwaway fake package instead of the repo.
const baseDir = path.join(os.tmpdir(), `pake-staging-${process.pid}`);
const fakePkg = path.join(baseDir, 'pkg');

vi.mock('@/utils/dir', async () => {
  const { default: nodePath } = await import('path');
  const { default: nodeOs } = await import('os');
  const base = nodePath.join(nodeOs.tmpdir(), `pake-staging-${process.pid}`);
  return {
    npmDirectory: nodePath.join(base, 'pkg'),
    tauriConfigDirectory: nodePath.join(base, 'pkg', 'src-tauri', '.pake'),
  };
});

import { handleLocalFile, restoreLocalTree } from '@/helpers/merge';
import { PakeTauriConfig } from '@/types';

function makeTauriConf(): PakeTauriConfig {
  return {
    pake: {
      windows: [{ url: '', url_type: 'web' } as never],
      user_agent: { macos: '', linux: '', windows: '' },
      system_tray: { macos: false, linux: false, windows: false },
      system_tray_path: '',
      proxy_url: '',
      multi_instance: false,
      multi_window: false,
    },
    bundle: {},
    app: {},
  };
}

async function makeUserDir(name: string): Promise<string> {
  const dir = path.join(baseDir, name);
  await fsExtra.ensureDir(dir);
  await fsExtra.writeFile(path.join(dir, 'index.html'), '<html></html>');
  await fsExtra.writeFile(path.join(dir, 'asset.txt'), 'asset');
  return dir;
}

describe('stageLocalTree via handleLocalFile', () => {
  beforeEach(async () => {
    await fsExtra.remove(baseDir);
    await fsExtra.ensureDir(path.join(fakePkg, 'dist'));
    await fsExtra.writeFile(path.join(fakePkg, 'dist', 'cli.js'), 'cli');
    await fsExtra.writeFile(path.join(fakePkg, 'dist', 'dev.js'), 'dev');
  });

  afterAll(async () => {
    await fsExtra.remove(baseDir);
  });

  it('stages a directory into dist and keeps cli.js, backing up the original', async () => {
    const userDir = await makeUserDir('site');
    const conf = makeTauriConf();
    await handleLocalFile(userDir, false, conf);

    const dist = path.join(fakePkg, 'dist');
    expect(await fsExtra.pathExists(path.join(dist, 'index.html'))).toBe(true);
    expect(await fsExtra.pathExists(path.join(dist, 'asset.txt'))).toBe(true);
    expect(await fsExtra.readFile(path.join(dist, 'cli.js'), 'utf8')).toBe(
      'cli',
    );
    // Original package dist preserved in dist_bak.
    const bak = path.join(fakePkg, 'dist_bak');
    expect(await fsExtra.readFile(path.join(bak, 'dev.js'), 'utf8')).toBe(
      'dev',
    );
    expect(conf.pake.windows[0].url).toBe('index.html');
    expect(conf.pake.windows[0].url_type).toBe('local');
  });

  it('restoreLocalTree puts the original dist back and removes dist_bak', async () => {
    const userDir = await makeUserDir('site');
    await handleLocalFile(userDir, false, makeTauriConf());

    restoreLocalTree();

    const dist = path.join(fakePkg, 'dist');
    expect(await fsExtra.readFile(path.join(dist, 'dev.js'), 'utf8')).toBe(
      'dev',
    );
    expect(await fsExtra.pathExists(path.join(dist, 'index.html'))).toBe(false);
    expect(await fsExtra.pathExists(path.join(fakePkg, 'dist_bak'))).toBe(
      false,
    );
  });

  it('restores the original dist when staging fails midway', async () => {
    const userDir = await makeUserDir('broken');
    // Dangling symlink: copySync with dereference follows it and throws.
    fs.symlinkSync(
      path.join(userDir, 'missing-target'),
      path.join(userDir, 'dangling'),
    );

    await expect(
      handleLocalFile(userDir, false, makeTauriConf()),
    ).rejects.toBeTruthy();

    // The failed staging must leave the package usable: original dist back,
    // no dist_bak left behind.
    const dist = path.join(fakePkg, 'dist');
    expect(await fsExtra.readFile(path.join(dist, 'cli.js'), 'utf8')).toBe(
      'cli',
    );
    expect(await fsExtra.readFile(path.join(dist, 'dev.js'), 'utf8')).toBe(
      'dev',
    );
    expect(await fsExtra.pathExists(path.join(dist, 'index.html'))).toBe(false);
    expect(await fsExtra.pathExists(path.join(fakePkg, 'dist_bak'))).toBe(
      false,
    );
  });

  it('copies through a symlinked input without writing into the real source', async () => {
    const realDir = await makeUserDir('real-site');
    const linkPath = path.join(baseDir, 'link-to-site');
    fs.symlinkSync(realDir, linkPath);

    await handleLocalFile(linkPath, false, makeTauriConf());

    const dist = path.join(fakePkg, 'dist');
    expect(fs.lstatSync(dist).isSymbolicLink()).toBe(false);
    expect(await fsExtra.pathExists(path.join(dist, 'index.html'))).toBe(true);
    // cli.js copy-back must land in the staged copy, never in the user's dir.
    expect(await fsExtra.pathExists(path.join(realDir, 'cli.js'))).toBe(false);
  });

  it('rejects an input directory that contains the CLI package itself', async () => {
    await fsExtra.writeFile(path.join(baseDir, 'index.html'), '<html></html>');

    await expect(
      handleLocalFile(baseDir, false, makeTauriConf()),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    // Guard fires before any move: dist untouched, no dist_bak.
    expect(await fsExtra.pathExists(path.join(fakePkg, 'dist', 'cli.js'))).toBe(
      true,
    );
    expect(await fsExtra.pathExists(path.join(fakePkg, 'dist_bak'))).toBe(
      false,
    );
  });

  it("rejects the package's own dist as input", async () => {
    await fsExtra.writeFile(
      path.join(fakePkg, 'dist', 'index.html'),
      '<html></html>',
    );

    await expect(
      handleLocalFile(path.join(fakePkg, 'dist'), false, makeTauriConf()),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    expect(await fsExtra.pathExists(path.join(fakePkg, 'dist', 'cli.js'))).toBe(
      true,
    );
  });
});
