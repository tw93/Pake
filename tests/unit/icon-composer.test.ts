import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fsExtra from 'fs-extra';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({
  execa: execaMock,
}));

import {
  actoolMajorVersion,
  applyDarwinIconComposerPackage,
  iconPathExtension,
  isIconComposerUrl,
  isMacOSIconComposerPackage,
  parseActoolVersion,
  precompileIconComposerAssets,
} from '@/helpers/icon-composer';
import { mergeIcons } from '@/helpers/merge';
import { setBuildDirectory, npmDirectory } from '@/utils/dir';
import { getSafeAppName } from '@/utils/name';
import { DEFAULT_PAKE_OPTIONS } from '../../bin/defaults';
import type { PakeAppOptions, PakeTauriConfig } from '../../bin/types';

const ORIGINAL_NPM_DIRECTORY = `${npmDirectory}`;
const tempDirs: string[] = [];

async function makeTempDir(prefix = 'pake-icon-composer-') {
  const tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}

async function makeIconPackage(
  root: string,
  name = 'AppIcon.icon',
): Promise<string> {
  const pkg = path.join(root, name);
  await fsExtra.ensureDir(path.join(pkg, 'Assets'));
  await fsExtra.writeJson(path.join(pkg, 'icon.json'), {
    fill: 'automatic',
    groups: [],
  });
  await fsExtra.writeFile(
    path.join(pkg, 'Assets', 'icon.png'),
    Buffer.from([1, 2, 3, 4]),
  );
  return pkg;
}

function makeTauriConf(): PakeTauriConfig {
  return {
    pake: {
      windows: [],
      user_agent: { macos: '', linux: '', windows: '' },
      system_tray: { macos: false, linux: false, windows: false },
      system_tray_path: '',
      proxy_url: '',
      download_dir: '',
      basic_auth: false,
      multi_instance: false,
      multi_window: false,
    },
    bundle: { icon: [] },
    app: {},
  };
}

function makeOptions(icon: string, name = 'Weekly'): PakeAppOptions {
  return {
    ...DEFAULT_PAKE_OPTIONS,
    identifier: 'com.pake.test',
    name,
    icon,
  } as PakeAppOptions;
}

afterEach(async () => {
  setBuildDirectory(ORIGINAL_NPM_DIRECTORY);
  execaMock.mockReset();
  await Promise.all(tempDirs.splice(0).map((dir) => fsExtra.remove(dir)));
});

describe('iconPathExtension and isIconComposerUrl', () => {
  it('strips a trailing slash so a .icon directory keeps its extension', () => {
    expect(iconPathExtension('/tmp/AppIcon.icon/')).toBe('.icon');
    expect(iconPathExtension('/tmp/AppIcon.icon')).toBe('.icon');
    expect(iconPathExtension('/tmp/AppIcon.icns')).toBe('.icns');
  });

  it('recognises .icon URLs and ignores ordinary image URLs', () => {
    expect(isIconComposerUrl('https://example.com/AppIcon.icon')).toBe(true);
    expect(isIconComposerUrl('https://example.com/AppIcon.icon/')).toBe(true);
    expect(isIconComposerUrl('https://cdn.tw93.fun/pake/weekly.icns')).toBe(
      false,
    );
  });
});

describe('isMacOSIconComposerPackage', () => {
  it('accepts a directory that contains icon.json', async () => {
    const root = await makeTempDir();
    const pkg = await makeIconPackage(root);
    await expect(isMacOSIconComposerPackage(pkg)).resolves.toBe(true);
  });

  it('rejects a regular file that happens to be named .icon', async () => {
    const root = await makeTempDir();
    const fake = path.join(root, 'AppIcon.icon');
    await fsExtra.writeFile(fake, 'not a package');
    await expect(isMacOSIconComposerPackage(fake)).resolves.toBe(false);
  });

  it('rejects a directory without icon.json', async () => {
    const root = await makeTempDir();
    const pkg = path.join(root, 'AppIcon.icon');
    await fsExtra.ensureDir(pkg);
    await expect(isMacOSIconComposerPackage(pkg)).resolves.toBe(false);
  });
});

describe('parseActoolVersion', () => {
  it('reads short-bundle-version from actool output', () => {
    const output = [
      '/* com.apple.actool.version */',
      'bundle-version: 24765',
      'short-bundle-version: 26.4.1',
    ].join('\n');
    expect(parseActoolVersion(output)).toBe('26.4.1');
    expect(actoolMajorVersion('26.4.1')).toBe(26);
    expect(actoolMajorVersion('16.0')).toBe(16);
  });

  it('returns null when the version line is missing', () => {
    expect(parseActoolVersion('actool: command not found')).toBeNull();
  });
});

describe('applyDarwinIconComposerPackage', () => {
  it('ships only a sibling .icns when Assets.car could not be precompiled', async () => {
    const root = await makeTempDir();
    const pkg = await makeIconPackage(root);
    await fsExtra.writeFile(path.join(root, 'AppIcon.icns'), 'sibling-icns');
    const destIconsDir = path.join(root, 'dest');
    const defaultIcns = path.join(root, 'default.icns');
    await fsExtra.writeFile(defaultIcns, 'default-icns');

    const { bundleIcon } = await applyDarwinIconComposerPackage({
      sourceIconPath: pkg,
      destIconsDir,
      safeAppName: 'weekly',
      defaultIcnsPath: defaultIcns,
    });

    expect(bundleIcon).toEqual(['icons/weekly.icns']);
    expect(
      await fsExtra.pathExists(
        path.join(destIconsDir, 'weekly.icon', 'icon.json'),
      ),
    ).toBe(true);
    expect(
      await fsExtra.readFile(path.join(destIconsDir, 'weekly.icns'), 'utf8'),
    ).toBe('sibling-icns');
  });

  it('uses the default .icns when there is no sibling file', async () => {
    const root = await makeTempDir();
    const pkg = await makeIconPackage(root);
    const destIconsDir = path.join(root, 'dest');
    const defaultIcns = path.join(root, 'icon.icns');
    await fsExtra.writeFile(defaultIcns, 'default-icns');

    const { bundleIcon } = await applyDarwinIconComposerPackage({
      sourceIconPath: pkg,
      destIconsDir,
      safeAppName: 'weekly',
      defaultIcnsPath: defaultIcns,
    });

    expect(bundleIcon).toEqual(['icons/weekly.icns']);
    expect(
      await fsExtra.readFile(path.join(destIconsDir, 'weekly.icns'), 'utf8'),
    ).toBe('default-icns');
  });
});

describe('precompileIconComposerAssets', () => {
  function actoolVersionResult(version: string) {
    return {
      exitCode: 0,
      stdout: `/* com.apple.actool.version */\nshort-bundle-version: ${version}\n`,
      stderr: '',
    };
  }

  it('copies Assets.car to the destination before cleaning the temp directory', async () => {
    const root = await makeTempDir();
    const pkg = await makeIconPackage(root);
    const destIconsDir = path.join(root, 'dest');

    execaMock.mockImplementation(async (file: string, args: string[] = []) => {
      const compileAt = args.indexOf('--compile');
      if (compileAt >= 0) {
        const outputPath = args[compileAt + 1];
        await fsExtra.ensureDir(outputPath);
        await fsExtra.writeFile(
          path.join(outputPath, 'Assets.car'),
          'compiled-car',
        );
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (
        args.includes('--version') ||
        args.includes('--output-format=human-readable-text')
      ) {
        return actoolVersionResult('26.1');
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const dest = await precompileIconComposerAssets(pkg, destIconsDir);

    expect(dest).toBe(path.join(destIconsDir, 'Assets.car'));
    expect(await fsExtra.pathExists(dest!)).toBe(true);
    expect(await fsExtra.readFile(dest!, 'utf8')).toBe('compiled-car');
    expect(
      execaMock.mock.calls.some(
        (call) => call[2] && (call[2] as { stdin?: string }).stdin === 'ignore',
      ),
    ).toBe(true);
  });

  it('skips compilation when actool is older than 26', async () => {
    const root = await makeTempDir();
    const pkg = await makeIconPackage(root);

    execaMock.mockResolvedValue(actoolVersionResult('16.4'));

    await expect(
      precompileIconComposerAssets(pkg, path.join(root, 'dest')),
    ).resolves.toBeNull();

    const compiled = execaMock.mock.calls.some((call) =>
      (call[1] as string[] | undefined)?.includes('--compile'),
    );
    expect(compiled).toBe(false);
  });

  it('gives up after one failed compile without stopping other processes', async () => {
    const root = await makeTempDir();
    const pkg = await makeIconPackage(root);
    let compileAttempts = 0;

    execaMock.mockImplementation(async (_file: string, args: string[] = []) => {
      if (args.includes('--compile')) {
        compileAttempts += 1;
        return { exitCode: 1, stdout: '', stderr: 'failed to run actool' };
      }
      return actoolVersionResult('27.2');
    });

    await expect(
      precompileIconComposerAssets(pkg, path.join(root, 'dest')),
    ).resolves.toBeNull();
    expect(compileAttempts).toBe(1);
    expect(execaMock.mock.calls.some((call) => call[0] === 'pkill')).toBe(
      false,
    );
  });

  it('puts the precompiled Assets.car and the .icns in bundle.icon, never the .icon', async () => {
    const root = await makeTempDir();
    const pkg = await makeIconPackage(root);
    const destIconsDir = path.join(root, 'dest');
    const defaultIcns = path.join(root, 'icon.icns');
    await fsExtra.writeFile(defaultIcns, 'default-icns');

    execaMock.mockImplementation(async (_file: string, args: string[] = []) => {
      const compileAt = args.indexOf('--compile');
      if (compileAt >= 0) {
        const outputPath = args[compileAt + 1];
        await fsExtra.ensureDir(outputPath);
        await fsExtra.writeFile(
          path.join(outputPath, 'Assets.car'),
          'compiled-car',
        );
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return actoolVersionResult('27.2');
    });

    const { bundleIcon } = await applyDarwinIconComposerPackage({
      sourceIconPath: pkg,
      destIconsDir,
      safeAppName: 'weekly',
      defaultIcnsPath: defaultIcns,
    });

    expect(bundleIcon).toEqual(['icons/Assets.car', 'icons/weekly.icns']);
  });
});

describe('mergeIcons on darwin', () => {
  async function setupNpmDir() {
    const root = await makeTempDir('pake-merge-icons-');
    setBuildDirectory(root);
    await fsExtra.ensureDir(path.join(root, 'src-tauri/icons'));
    await fsExtra.ensureDir(path.join(root, 'src-tauri/png'));
    await fsExtra.writeFile(
      path.join(root, 'src-tauri/icons/icon.icns'),
      'default-icns',
    );
    return root;
  }

  it('passes a sibling .icns when Assets.car is not available', async () => {
    const root = await setupNpmDir();
    const pkg = await makeIconPackage(root);
    await fsExtra.writeFile(path.join(root, 'AppIcon.icns'), 'sibling-icns');
    const tauriConf = makeTauriConf();
    const name = 'Weekly';
    const safe = getSafeAppName(name);

    await mergeIcons(makeOptions(pkg, name), name, tauriConf, 'darwin', safe);

    expect(tauriConf.bundle.icon).toEqual([`icons/${safe}.icns`]);
    expect(tauriConf.bundle.resources).toEqual([`icons/${safe}.icns`]);
    expect(
      await fsExtra.readFile(
        path.join(root, 'src-tauri/icons', `${safe}.icns`),
        'utf8',
      ),
    ).toBe('sibling-icns');
  });

  it('falls back to the default .icns when only a .icon is given', async () => {
    const root = await setupNpmDir();
    const pkg = await makeIconPackage(root);
    const tauriConf = makeTauriConf();
    const name = 'Weekly';
    const safe = getSafeAppName(name);

    await mergeIcons(makeOptions(pkg, name), name, tauriConf, 'darwin', safe);

    expect(tauriConf.bundle.icon).toEqual([`icons/${safe}.icns`]);
    expect(tauriConf.bundle.resources).toEqual([`icons/${safe}.icns`]);
    expect(
      await fsExtra.readFile(
        path.join(root, 'src-tauri/icons', `${safe}.icns`),
        'utf8',
      ),
    ).toBe('default-icns');
  });

  it('keeps a precompiled Assets.car out of bundle.resources', async () => {
    const root = await setupNpmDir();
    const pkg = await makeIconPackage(root);
    const tauriConf = makeTauriConf();
    const name = 'Weekly';
    const safe = getSafeAppName(name);
    execaMock.mockImplementation(async (_file: string, args: string[] = []) => {
      const compileAt = args.indexOf('--compile');
      if (compileAt >= 0) {
        const outputPath = args[compileAt + 1];
        await fsExtra.ensureDir(outputPath);
        await fsExtra.writeFile(
          path.join(outputPath, 'Assets.car'),
          'compiled-car',
        );
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return {
        exitCode: 0,
        stdout: 'short-bundle-version: 27.2\n',
        stderr: '',
      };
    });

    await mergeIcons(makeOptions(pkg, name), name, tauriConf, 'darwin', safe);

    expect(tauriConf.bundle.icon).toEqual([
      'icons/Assets.car',
      `icons/${safe}.icns`,
    ]);
    expect(tauriConf.bundle.resources).toEqual([`icons/${safe}.icns`]);
  });

  it('keeps a plain .icns icon on the existing path', async () => {
    const root = await setupNpmDir();
    const icns = path.join(root, 'custom.icns');
    await fsExtra.writeFile(icns, 'custom-icns');
    const tauriConf = makeTauriConf();
    const name = 'Weekly';
    const safe = getSafeAppName(name);

    await mergeIcons(makeOptions(icns, name), name, tauriConf, 'darwin', safe);

    expect(tauriConf.bundle.icon).toEqual([`icons/${safe}.icns`]);
  });

  it('rejects a file named .icon that is not a Composer package', async () => {
    const root = await setupNpmDir();
    const fake = path.join(root, 'AppIcon.icon');
    await fsExtra.writeFile(fake, 'not-a-package');
    const tauriConf = makeTauriConf();
    const name = 'Weekly';
    const safe = getSafeAppName(name);

    await mergeIcons(makeOptions(fake, name), name, tauriConf, 'darwin', safe);

    expect(tauriConf.bundle.icon).toEqual(['icons/icon.icns']);
  });

  it('warns and uses the default icon for a wrong extension, as before', async () => {
    const root = await setupNpmDir();
    const png = path.join(root, 'icon.png');
    await fsExtra.writeFile(png, 'png');
    const tauriConf = makeTauriConf();
    const name = 'Weekly';
    const safe = getSafeAppName(name);

    await mergeIcons(makeOptions(png, name), name, tauriConf, 'darwin', safe);

    expect(tauriConf.bundle.icon).toEqual(['icons/icon.icns']);
  });
});
