import path from 'path';
import os from 'os';
import fsExtra from 'fs-extra';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { handleLocalFile } from '@/helpers/merge';
import { PakeTauriConfig } from '@/types';

// Staging a real directory rewrites the package's own dist/, so tests cover
// only the paths that return or throw before any staging happens.
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

describe('handleLocalFile', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'pake-local-'));
  });

  afterAll(async () => {
    await fsExtra.remove(tmpDir);
  });

  it('treats a non-existing path as a web url', async () => {
    const conf = makeTauriConf();
    await handleLocalFile('https://example.com', false, conf);
    expect(conf.pake.windows[0].url_type).toBe('web');
  });

  it('rejects a directory without index.html at its root', async () => {
    const emptyDir = path.join(tmpDir, 'no-entry');
    await fsExtra.ensureDir(emptyDir);
    // index.html nested one level down must not count as a root entry.
    await fsExtra.ensureDir(path.join(emptyDir, 'nested'));
    await fsExtra.writeFile(
      path.join(emptyDir, 'nested', 'index.html'),
      '<html></html>',
    );

    const conf = makeTauriConf();
    await expect(handleLocalFile(emptyDir, false, conf)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    // Config must be untouched on failure.
    expect(conf.pake.windows[0].url).toBe('');
  });
});
