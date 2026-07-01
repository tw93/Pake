import crypto from 'node:crypto';
import path from 'path';
import fsExtra from 'fs-extra';

import type { PakeHistoryEntry, PakeRegistry } from '@/types';

export async function readRegistry(
  registryPath: string,
): Promise<PakeRegistry> {
  try {
    const content = await fsExtra.readFile(registryPath, 'utf8');
    const parsed = JSON.parse(content) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as PakeRegistry).entries)
    ) {
      throw new Error('registry file is not a valid Pake registry');
    }

    return parsed as PakeRegistry;
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException;
    if (errnoError.code === 'ENOENT') {
      return { entries: [] };
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Pake registry: ${message}`);
  }
}

function getRegistryTempPath(registryDir: string): string {
  return path.join(
    registryDir,
    `history.json.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
  );
}

export async function writeRegistry(
  registryPath: string,
  registry: PakeRegistry,
): Promise<void> {
  const registryDir = path.dirname(registryPath);
  const tmpPath = getRegistryTempPath(registryDir);

  await fsExtra.ensureDir(registryDir);
  await fsExtra.writeFile(tmpPath, `${JSON.stringify(registry, null, 2)}\n`);

  try {
    await fsExtra.rename(tmpPath, registryPath);
  } catch (error) {
    await fsExtra.remove(tmpPath).catch(() => {
      // Ignore cleanup errors so the original rename error is preserved.
    });
    throw error;
  }
}

export function findEntryByName(
  registry: PakeRegistry,
  name: string,
): PakeHistoryEntry | undefined {
  const lowerName = name.toLowerCase();
  return registry.entries.find(
    (entry) => entry.name.toLowerCase() === lowerName,
  );
}

export function findEntryById(
  registry: PakeRegistry,
  id: string,
): PakeHistoryEntry | undefined {
  return registry.entries.find((entry) => entry.id === id);
}

export function addOrUpdateEntry(
  registry: PakeRegistry,
  newEntry: PakeHistoryEntry,
): void {
  const existingIndex = registry.entries.findIndex(
    (entry) => entry.id === newEntry.id,
  );

  if (existingIndex === -1) {
    registry.entries.push(newEntry);
    return;
  }

  const existing = registry.entries[existingIndex];
  existing.last_build_at = newEntry.last_build_at;
  existing.pake_version = newEntry.pake_version;
  existing.app_version = newEntry.app_version;

  for (const newTarget of newEntry.targets) {
    const targetIndex = existing.targets.findIndex(
      (target) =>
        target.platform === newTarget.platform &&
        target.format === newTarget.format,
    );

    if (targetIndex === -1) {
      existing.targets.push(newTarget);
    } else {
      existing.targets[targetIndex] = newTarget;
    }
  }
}

export function removeEntry(registry: PakeRegistry, id: string): void {
  registry.entries = registry.entries.filter((entry) => entry.id !== id);
}

export function generateEntryId(url: string, name: string): string {
  // Use "::" as a delimiter to prevent collisions such as
  // ("https://a.com", "bc") and ("https://a.comb", "c").
  return crypto
    .createHash('sha256')
    .update(`${url}::${name}`)
    .digest('hex')
    .slice(0, 12);
}
