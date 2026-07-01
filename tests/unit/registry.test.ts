import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fsExtra from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PakeHistoryEntry, PakeRegistry } from '@/types';
import {
  addOrUpdateEntry,
  findEntryById,
  findEntryByName,
  generateEntryId,
  readRegistry,
  removeEntry,
  writeRegistry,
} from '@/utils/registry';

describe('registry', () => {
  const tempFiles: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempFiles.splice(0).map((file) => fsExtra.remove(file)));
  });

  async function tempRegistryPath(): Promise<string> {
    const tempDir = await fsExtra.mkdtemp(
      path.join(os.tmpdir(), 'pake-registry-'),
    );
    tempFiles.push(tempDir);
    return path.join(tempDir, 'history.json');
  }

  function createEntry(partial?: Partial<PakeHistoryEntry>): PakeHistoryEntry {
    return {
      id:
        partial?.id ??
        generateEntryId(
          partial?.url ?? 'https://github.com',
          partial?.name ?? 'GitHub',
        ),
      name: partial?.name ?? 'GitHub',
      url: partial?.url ?? 'https://github.com',
      identifier: partial?.identifier ?? 'com.pake.github',
      created_at: partial?.created_at ?? '2026-06-30T12:00:00Z',
      last_build_at: partial?.last_build_at ?? '2026-06-30T12:00:00Z',
      pake_version: partial?.pake_version ?? '3.13.0',
      app_version: partial?.app_version ?? '1.0.0',
      targets: partial?.targets ?? [
        {
          platform: 'linux',
          format: 'deb',
          output_path: '/home/you/GitHub.deb',
          built_at: '2026-06-30T12:00:00Z',
        },
      ],
    };
  }

  it('returns an empty registry when the file does not exist', async () => {
    const registryPath = await tempRegistryPath();

    const registry = await readRegistry(registryPath);

    expect(registry.entries).toEqual([]);
  });

  it('throws a clear error when the registry contains corrupt JSON', async () => {
    const registryPath = await tempRegistryPath();
    await fsExtra.writeFile(registryPath, 'not-json');

    await expect(readRegistry(registryPath)).rejects.toThrow(
      'Failed to read Pake registry',
    );
  });

  it('reads a valid registry file', async () => {
    const registryPath = await tempRegistryPath();
    const existing: PakeRegistry = { entries: [createEntry()] };
    await fsExtra.writeFile(registryPath, JSON.stringify(existing));

    const registry = await readRegistry(registryPath);

    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0].name).toBe('GitHub');
  });

  it('writes a registry file and creates the parent directory', async () => {
    const registryPath = await tempRegistryPath();
    const registry: PakeRegistry = { entries: [createEntry()] };

    await writeRegistry(registryPath, registry);

    const content = await fsExtra.readFile(registryPath, 'utf8');
    expect(JSON.parse(content)).toEqual(registry);
  });

  it('writes registry atomically via temp file and rename', async () => {
    const registryPath = await tempRegistryPath();
    const registryDir = path.dirname(registryPath);
    const registry: PakeRegistry = { entries: [createEntry()] };

    const ensureDirSpy = vi
      .spyOn(fsExtra, 'ensureDir')
      .mockResolvedValue(undefined);
    const writeFileSpy = vi
      .spyOn(fsExtra, 'writeFile')
      .mockResolvedValue(undefined);
    const renameSpy = vi.spyOn(fsExtra, 'rename').mockResolvedValue(undefined);

    await writeRegistry(registryPath, registry);

    const tmpPath = writeFileSpy.mock.calls[0][0] as string;

    expect(ensureDirSpy).toHaveBeenCalledWith(registryDir);
    expect(tmpPath).toMatch(/history\.json\.tmp-/);
    expect(tmpPath.startsWith(registryDir)).toBe(true);
    expect(writeFileSpy).toHaveBeenCalledWith(
      tmpPath,
      `${JSON.stringify(registry, null, 2)}\n`,
    );
    expect(renameSpy).toHaveBeenCalledWith(tmpPath, registryPath);
  });

  it('removes temp file when atomic rename fails', async () => {
    const registryPath = await tempRegistryPath();
    const registry: PakeRegistry = { entries: [createEntry()] };

    vi.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
    const writeFileSpy = vi
      .spyOn(fsExtra, 'writeFile')
      .mockResolvedValue(undefined);
    vi.spyOn(fsExtra, 'rename').mockRejectedValue(new Error('rename failed'));
    const removeSpy = vi.spyOn(fsExtra, 'remove').mockResolvedValue(undefined);

    await expect(writeRegistry(registryPath, registry)).rejects.toThrow(
      'rename failed',
    );

    const tmpPath = writeFileSpy.mock.calls[0][0] as string;
    expect(removeSpy).toHaveBeenCalledWith(tmpPath);
  });

  it('uses a unique temp file name for each writeRegistry call', async () => {
    const registryPath = await tempRegistryPath();
    const registry: PakeRegistry = { entries: [createEntry()] };

    vi.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
    vi.spyOn(fsExtra, 'rename').mockResolvedValue(undefined);
    const writeFileSpy = vi
      .spyOn(fsExtra, 'writeFile')
      .mockResolvedValue(undefined);

    await writeRegistry(registryPath, registry);
    await writeRegistry(registryPath, registry);

    expect(writeFileSpy).toHaveBeenCalledTimes(2);
    const firstTmpPath = writeFileSpy.mock.calls[0][0] as string;
    const secondTmpPath = writeFileSpy.mock.calls[1][0] as string;

    expect(firstTmpPath).not.toBe(secondTmpPath);
    expect(firstTmpPath).toMatch(/history\.json\.tmp-/);
    expect(secondTmpPath).toMatch(/history\.json\.tmp-/);
  });

  it('includes the process pid in the temp file name', async () => {
    const originalPid = process.pid;
    const testPid = 12345;
    Object.defineProperty(process, 'pid', { value: testPid });

    try {
      const registryPath = await tempRegistryPath();
      const registry: PakeRegistry = { entries: [createEntry()] };

      vi.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
      vi.spyOn(fsExtra, 'rename').mockResolvedValue(undefined);
      const writeFileSpy = vi
        .spyOn(fsExtra, 'writeFile')
        .mockResolvedValue(undefined);

      await writeRegistry(registryPath, registry);

      const tmpPath = writeFileSpy.mock.calls[0][0] as string;
      expect(tmpPath).toContain(`history.json.tmp-${testPid}-`);
    } finally {
      Object.defineProperty(process, 'pid', { value: originalPid });
    }
  });

  it('finds an entry by exact name', () => {
    const entry = createEntry({ name: 'GitHub' });
    const registry: PakeRegistry = { entries: [entry] };

    expect(findEntryByName(registry, 'GitHub')).toBe(entry);
  });

  it('finds an entry by name case-insensitively', () => {
    const entry = createEntry({ name: 'GitHub' });
    const registry: PakeRegistry = { entries: [entry] };

    expect(findEntryByName(registry, 'github')).toBe(entry);
  });

  it('finds an entry by id', () => {
    const entry = createEntry({ id: 'abc123' });
    const registry: PakeRegistry = { entries: [entry] };

    expect(findEntryById(registry, 'abc123')).toBe(entry);
  });

  it('upserts a new entry into the registry', () => {
    const registry: PakeRegistry = { entries: [] };
    const entry = createEntry();

    addOrUpdateEntry(registry, entry);

    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0].id).toBe(entry.id);
  });

  it('appends a new target when upserting an existing entry', () => {
    const registry: PakeRegistry = { entries: [createEntry()] };
    const updated = createEntry({
      targets: [
        {
          platform: 'darwin',
          format: 'dmg',
          install_path: '/Applications/GitHub.app',
          output_path: '/Users/you/GitHub.dmg',
          built_at: '2026-06-30T13:00:00Z',
        },
      ],
    });

    addOrUpdateEntry(registry, updated);

    expect(registry.entries[0].targets).toHaveLength(2);
    expect(registry.entries[0].targets[1].platform).toBe('darwin');
    expect(registry.entries[0].targets[1].format).toBe('dmg');
  });

  it('distinguishes targets by format when upserting', () => {
    const registry: PakeRegistry = {
      entries: [
        createEntry({
          targets: [
            {
              platform: 'linux',
              format: 'deb',
              output_path: '/home/you/GitHub.deb',
              built_at: '2026-06-30T12:00:00Z',
            },
          ],
        }),
      ],
    };
    const updated = createEntry({
      targets: [
        {
          platform: 'linux',
          format: 'rpm',
          output_path: '/home/you/GitHub.rpm',
          built_at: '2026-06-30T13:00:00Z',
        },
      ],
    });

    addOrUpdateEntry(registry, updated);

    expect(registry.entries[0].targets).toHaveLength(2);
    expect(registry.entries[0].targets[0].format).toBe('deb');
    expect(registry.entries[0].targets[1].format).toBe('rpm');
  });

  it('updates an existing target instead of duplicating it', () => {
    const registry: PakeRegistry = { entries: [createEntry()] };
    const updated = createEntry({
      targets: [
        {
          platform: 'linux',
          format: 'deb',
          output_path: '/home/you/GitHub-v2.deb',
          built_at: '2026-06-30T13:00:00Z',
        },
      ],
    });

    addOrUpdateEntry(registry, updated);

    expect(registry.entries[0].targets).toHaveLength(1);
    expect(registry.entries[0].targets[0].output_path).toBe(
      '/home/you/GitHub-v2.deb',
    );
    expect(registry.entries[0].targets[0].built_at).toBe(
      '2026-06-30T13:00:00Z',
    );
  });

  it('updates last_build_at while preserving created_at on upsert', () => {
    const registry: PakeRegistry = {
      entries: [createEntry({ created_at: '2026-06-30T10:00:00Z' })],
    };
    const updated = createEntry({ last_build_at: '2026-06-30T14:00:00Z' });

    addOrUpdateEntry(registry, updated);

    expect(registry.entries[0].created_at).toBe('2026-06-30T10:00:00Z');
    expect(registry.entries[0].last_build_at).toBe('2026-06-30T14:00:00Z');
  });

  it('removes an entry by id', () => {
    const entry = createEntry({ id: 'abc123' });
    const registry: PakeRegistry = { entries: [entry] };

    removeEntry(registry, 'abc123');

    expect(registry.entries).toHaveLength(0);
  });

  it('generates a stable 12-character hex id from url and name', () => {
    const id1 = generateEntryId('https://github.com', 'GitHub');
    const id2 = generateEntryId('https://github.com', 'GitHub');

    expect(id1).toBe(id2);
    expect(id1).toHaveLength(12);
    expect(/^[0-9a-f]{12}$/.test(id1)).toBe(true);
  });

  it('generates ids matching sha256(url::name) sliced to 12 hex chars', () => {
    const expected = crypto
      .createHash('sha256')
      .update('https://github.com::GitHub')
      .digest('hex')
      .slice(0, 12);

    expect(generateEntryId('https://github.com', 'GitHub')).toBe(expected);
  });

  it('avoids collisions between different url/name pairs', () => {
    const id1 = generateEntryId('https://a.com', 'bc');
    const id2 = generateEntryId('https://a.comb', 'c');

    expect(id1).not.toBe(id2);
  });
});
