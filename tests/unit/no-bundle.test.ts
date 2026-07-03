import path from 'path';
import { describe, it, expect, vi } from 'vitest';

// tauriConfig.ts reads pake.json at module load, keyed off npmDirectory.
// Point it at the repo root so the import chain resolves under vitest.
vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));

import LinuxBuilder from '@/builders/LinuxBuilder';
import { PakeAppOptions } from '@/types';

const makeBuilder = (bundle: boolean) =>
  new LinuxBuilder({ name: 'demo', targets: 'deb', bundle } as PakeAppOptions);

describe('LinuxBuilder --no-bundle', () => {
  it('appends --no-bundle and skips --bundles when bundle is false', () => {
    const cmd = (makeBuilder(false) as any).getBuildCommand('pnpm');
    expect(cmd).toContain('--no-bundle');
    expect(cmd).not.toContain('--bundles');
  });

  it('does not append --no-bundle when bundle is true (default)', () => {
    const cmd = (makeBuilder(true) as any).getBuildCommand('pnpm');
    expect(cmd).not.toContain('--no-bundle');
  });
});
