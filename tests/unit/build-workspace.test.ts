import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/utils/dir', () => ({
  packageDirectory: process.cwd(),
  setBuildDirectory: vi.fn(),
}));
import {
  createBuildWorkspace,
  acquireBuildCache,
} from '@/utils/build-workspace';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => fs.remove(directory)),
  );
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pake-workspace-test-'));
  directories.push(root);
  await fs.outputJSON(path.join(root, 'package.json'), { name: 'fixture' });
  await fs.outputFile(
    path.join(root, 'src-tauri', 'src', 'inject', 'custom.js'),
    'template',
  );
  await fs.outputFile(
    path.join(root, 'src-tauri', '.pake', 'pake.json'),
    'previous user',
  );
  await fs.outputFile(
    path.join(root, 'src-tauri', 'target', 'private'),
    'old cache',
  );
  await fs.outputFile(path.join(root, 'dist', 'cli.js'), 'cli');
  await fs.outputFile(
    path.join(root, 'dist', 'private.html'),
    'previous local input',
  );
  await fs.outputFile(
    path.join(root, 'node_modules', 'dependency', 'index.js'),
    'dependency',
  );
  await fs.outputJSON(
    path.join(root, 'node_modules', '@tauri-apps', 'cli', 'package.json'),
    { name: '@tauri-apps/cli' },
  );
  await fs.outputFile(
    path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
    'process.exit(process.argv[2] === "--version" ? 0 : 1);',
  );
  const launcher = path.join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tauri.cmd' : 'tauri',
  );
  await fs.outputFile(launcher, 'fixture');
  await fs.chmod(launcher, 0o755);
  return root;
}

describe('build workspace', () => {
  it.each(['rust-toolchain.toml', 'rust-toolchain'])(
    'preserves the source toolchain selection in %s',
    async (file) => {
      const source = await fixture();
      const content = file.endsWith('.toml')
        ? '[toolchain]\nchannel = "1.95.0"\n'
        : '1.95.0\n';
      await fs.writeFile(path.join(source, file), content);
      const root = await createBuildWorkspace(source);
      directories.push(root);
      expect(await fs.readFile(path.join(root, file), 'utf8')).toBe(content);
    },
  );

  it('isolates simultaneous build inputs without copying stale local content or cache', async () => {
    const source = await fixture();
    const roots = await Promise.all([
      createBuildWorkspace(source),
      createBuildWorkspace(source),
    ]);
    directories.push(...roots);
    expect(roots[0]).not.toBe(roots[1]);
    await fs.writeFile(
      path.join(roots[0], 'src-tauri', 'src', 'inject', 'custom.js'),
      'first user',
    );
    for (const root of [source, roots[1]]) {
      expect(
        await fs.readFile(
          path.join(root, 'src-tauri', 'src', 'inject', 'custom.js'),
          'utf8',
        ),
      ).toBe('template');
    }
    for (const root of roots) {
      expect(await fs.pathExists(path.join(root, 'src-tauri', '.pake'))).toBe(
        false,
      );
      expect(await fs.pathExists(path.join(root, 'src-tauri', 'target'))).toBe(
        false,
      );
      expect(await fs.readdir(path.join(root, 'dist'))).toEqual(['cli.js']);
      expect(await fs.realpath(path.join(root, 'node_modules'))).toBe(
        await fs.realpath(path.join(source, 'node_modules')),
      );
    }
  });

  it('holds shared cache ownership until the previous build releases it', async () => {
    const source = await fixture();
    const target = path.join(source, 'cache');
    const firstRelease = await acquireBuildCache(target);
    let acquired = false;
    const second = acquireBuildCache(target).then((release) => {
      acquired = true;
      return release;
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(acquired).toBe(false);
    await firstRelease();
    const secondRelease = await second;
    expect(acquired).toBe(true);
    await secondRelease();
    expect(await fs.pathExists(path.join(target, '.pake-build.lock'))).toBe(
      false,
    );
  });

  it('cleans a failed partial copy without returning an unusable workspace', async () => {
    const source = await fixture();
    await fs.remove(path.join(source, 'dist', 'cli.js'));
    await expect(createBuildWorkspace(source)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(
      await fs.readFile(
        path.join(source, 'src-tauri', 'src', 'inject', 'custom.js'),
        'utf8',
      ),
    ).toBe('template');
  });

  it('does not link incomplete dependencies that the install fallback would mutate', async () => {
    const source = await fixture();
    await fs.remove(path.join(source, 'node_modules', '@tauri-apps'));
    const root = await createBuildWorkspace(source);
    directories.push(root);
    expect(await fs.pathExists(path.join(root, 'node_modules'))).toBe(false);
    expect(
      await fs.readFile(
        path.join(source, 'node_modules', 'dependency', 'index.js'),
        'utf8',
      ),
    ).toBe('dependency');
  });

  it('does not link a manifest-only installation missing its CLI entry', async () => {
    const source = await fixture();
    await fs.remove(
      path.join(source, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
    );
    const root = await createBuildWorkspace(source);
    directories.push(root);
    expect(await fs.pathExists(path.join(root, 'node_modules'))).toBe(false);
    expect(
      await fs.pathExists(
        path.join(source, 'node_modules', '@tauri-apps', 'cli', 'package.json'),
      ),
    ).toBe(true);
  });

  it('never removes an abandoned lock while another waiter could be acquiring it', async () => {
    const source = await fixture();
    const target = path.join(source, 'cache');
    const lock = path.join(target, '.pake-build.lock');
    // Obtain an actual exited PID rather than assume a large PID is absent.
    const { execFileSync } = await import('child_process');
    const owner = execFileSync(
      process.execPath,
      ['-e', 'process.stdout.write(String(process.pid))'],
      { encoding: 'utf8' },
    );
    await fs.outputFile(lock, owner);
    const results = await Promise.allSettled([
      acquireBuildCache(target),
      acquireBuildCache(target),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(await fs.readFile(lock, 'utf8')).toBe(owner);
  });
});

it('prepares private inputs without taking a busy compilation cache and leaves its owner intact', async () => {
  const { enterBuildWorkspace } = await import('@/utils/build-workspace');
  const source = await fixture();
  const target = path.join(source, 'cache');
  const original = process.env.CARGO_TARGET_DIR;
  process.env.CARGO_TARGET_DIR = target;
  const release = await acquireBuildCache(target);
  const pending = enterBuildWorkspace();
  let timer: ReturnType<typeof setTimeout>;
  try {
    const workspace = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Preparation blocked by compilation lock')),
          2000,
        );
      }),
    ]);
    await workspace();
    expect(
      await fs.readFile(path.join(target, '.pake-build.lock'), 'utf8'),
    ).toBe(String(process.pid));
  } finally {
    clearTimeout(timer!);
    await release();
    await pending.then((workspace) => workspace());
    if (original === undefined) delete process.env.CARGO_TARGET_DIR;
    else process.env.CARGO_TARGET_DIR = original;
  }
});
