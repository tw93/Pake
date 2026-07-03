import os from 'os';
import path from 'path';
import fsExtra from 'fs-extra';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PAKE_OPTIONS } from '../../bin/defaults';
import type { PakeAppOptions } from '../../bin/types';

const tempDirs: string[] = [];

async function makeTempDir() {
  const tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), 'pake-icon-'));
  tempDirs.push(tempDir);
  return tempDir;
}

async function makePngIcon(size: number): Promise<string> {
  const tempDir = await makeTempDir();
  const iconPath = path.join(tempDir, `icon-${size}.png`);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 40, g: 120, b: 220, alpha: 1 },
    },
  })
    .png()
    .toFile(iconPath);
  return iconPath;
}

async function importLinuxIconModule() {
  vi.resetModules();
  vi.doMock('@/utils/platform', () => ({
    IS_MAC: false,
    IS_WIN: false,
    IS_LINUX: true,
  }));
  return await import('../../bin/options/icon');
}

function makeOptions(icon: string): PakeAppOptions {
  return {
    ...DEFAULT_PAKE_OPTIONS,
    identifier: 'com.pake.test',
    name: 'Linux App',
    icon,
  };
}

describe('Linux icon handling', () => {
  afterEach(async () => {
    vi.doUnmock('@/utils/platform');
    vi.resetModules();
    await Promise.all(tempDirs.splice(0).map((dir) => fsExtra.remove(dir)));
  });

  it('keeps a 512px PNG icon without reconverting it', async () => {
    const sourceIcon = await makePngIcon(512);
    const { handleIcon } = await importLinuxIconModule();

    await expect(handleIcon(makeOptions(sourceIcon))).resolves.toBe(sourceIcon);
  });

  it('converts a non-512px PNG icon to a Linux bundle-ready icon', async () => {
    const sourceIcon = await makePngIcon(128);
    const { handleIcon } = await importLinuxIconModule();

    const result = await handleIcon(makeOptions(sourceIcon));
    const metadata = await sharp(result).metadata();
    const generatedRoot = path.dirname(path.dirname(result));
    tempDirs.push(generatedRoot);

    expect(result).not.toBe(sourceIcon);
    expect(path.basename(result)).toBe('linux-app_512.png');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
  });
});
