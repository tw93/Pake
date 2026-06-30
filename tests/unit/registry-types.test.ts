import { describe, expect, it } from 'vitest';
import type {
  PakeHistoryEntry,
  PakeHistoryTarget,
  PakeHistoryTargetFormat,
  PakeHistoryTargetPlatform,
  PakeRegistry,
} from '@/types';

describe('registry types', () => {
  it('exports platform union', () => {
    const platform: PakeHistoryTargetPlatform = 'linux';
    expect(['darwin', 'windows', 'linux']).toContain(platform);
  });

  it('exports format union', () => {
    const format: PakeHistoryTargetFormat = 'deb';
    expect(['dmg', 'app', 'msi', 'deb', 'rpm', 'appimage', 'zst', 'raw']).toContain(format);
  });

  it('can build a target object', () => {
    const target: PakeHistoryTarget = {
      platform: 'linux',
      target: 'deb',
      install_path: undefined,
      output_path: '/home/you/GitHub.deb',
      built_at: '2026-06-30T12:00:00Z',
    };

    expect(target.platform).toBe('linux');
    expect(target.target).toBe('deb');
  });

  it('can build an entry object', () => {
    const entry: PakeHistoryEntry = {
      id: 'a1b2c3',
      name: 'GitHub',
      url: 'https://github.com',
      identifier: 'com.pake.a1b2c3',
      created_at: '2026-06-30T12:00:00Z',
      last_build_at: '2026-06-30T12:00:00Z',
      pake_version: '3.13.0',
      app_version: '1.0.0',
      targets: [
        {
          platform: 'darwin',
          target: 'dmg',
          install_path: '/Applications/GitHub.app',
          output_path: '/Users/you/GitHub.dmg',
          built_at: '2026-06-30T12:00:00Z',
        },
      ],
    };

    expect(entry.name).toBe('GitHub');
    expect(entry.targets).toHaveLength(1);
  });

  it('exports a registry shape', () => {
    const registry: PakeRegistry = { entries: [] };
    expect(registry.entries).toEqual([]);
  });
});
