import os from 'os';
import path from 'path';
import fsExtra from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveSystemTrayIconPath } from '../../bin/helpers/merge';
import logger from '../../bin/options/logger';

const tempDirs: string[] = [];

async function makeTempDir() {
  const tempDir = await fsExtra.mkdtemp(
    path.join(os.tmpdir(), 'pake-system-tray-icon-'),
  );
  tempDirs.push(tempDir);
  return tempDir;
}

describe('resolveSystemTrayIconPath', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempDirs.splice(0).map((dir) => fsExtra.remove(dir)));
  });

  it('keeps the default tray icon when no custom icon is configured', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(
      resolveSystemTrayIconPath('', 'png/icon_512.png', 'TestApp'),
    ).resolves.toBe('png/icon_512.png');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps the default tray icon for unsupported file extensions', async () => {
    const tempDir = await makeTempDir();
    const sourceIcon = path.join(tempDir, 'tray.svg');
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await fsExtra.outputFile(sourceIcon, '<svg />');

    await expect(
      resolveSystemTrayIconPath(
        sourceIcon,
        'png/icon_512.png',
        'TestApp',
        tempDir,
      ),
    ).resolves.toBe('png/icon_512.png');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be .ico or .png'),
    );
    await expect(
      fsExtra.pathExists(path.join(tempDir, 'TestApp.svg')),
    ).resolves.toBe(false);
  });

  it('keeps the default tray icon when the custom icon is missing', async () => {
    const tempDir = await makeTempDir();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(
      resolveSystemTrayIconPath(
        path.join(tempDir, 'missing.png'),
        'png/icon_512.png',
        'TestApp',
        tempDir,
      ),
    ).resolves.toBe('png/icon_512.png');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('was not found'),
    );
  });

  it('keeps the default tray icon when copying the custom icon fails', async () => {
    const tempDir = await makeTempDir();
    const sourceIcon = path.join(tempDir, 'tray.png');
    const blockedOutputPath = path.join(tempDir, 'not-a-directory');
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await fsExtra.outputFile(sourceIcon, 'custom-icon');
    await fsExtra.outputFile(blockedOutputPath, 'blocks-copy-target');

    await expect(
      resolveSystemTrayIconPath(
        sourceIcon,
        'png/icon_512.png',
        'TestApp',
        blockedOutputPath,
      ),
    ).resolves.toBe('png/icon_512.png');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to apply system tray icon'),
    );
  });

  it('returns the custom tray icon path only after copying succeeds', async () => {
    const tempDir = await makeTempDir();
    const outputDir = path.join(tempDir, 'png');
    const sourceIcon = path.join(tempDir, 'tray.png');

    await fsExtra.outputFile(sourceIcon, 'custom-icon');

    await expect(
      resolveSystemTrayIconPath(
        sourceIcon,
        'png/icon_512.png',
        'TestApp',
        outputDir,
      ),
    ).resolves.toBe('png/TestApp.png');
    await expect(
      fsExtra.readFile(path.join(outputDir, 'TestApp.png'), 'utf8'),
    ).resolves.toBe('custom-icon');
  });
});
