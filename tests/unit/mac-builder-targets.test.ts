import path from 'path';
import { describe, it, expect, vi } from 'vitest';

// tauriConfig.ts reads pake.json at module load, keyed off npmDirectory.
// Point it at the repo root so the import chain resolves under vitest.
vi.mock('@/utils/dir', () => ({
  npmDirectory: process.cwd(),
  tauriConfigDirectory: path.join(process.cwd(), 'src-tauri', '.pake'),
}));

import MacBuilder from '@/builders/MacBuilder';
import { PakeAppOptions } from '@/types';

const makeBuilder = (targets?: string) =>
  new MacBuilder({ name: 'Demo', targets } as PakeAppOptions);

describe('MacBuilder target selection', () => {
  it('builds an app bundle when --targets app is requested', () => {
    // The app format ships a bare `.app`, so the file name carries no
    // version/arch suffix. This proves `--targets app` is honoured rather
    // than silently coerced to the default DMG.
    expect(makeBuilder('app').getFileName()).toBe('Demo');
  });

  it('builds a DMG when --targets dmg is requested', () => {
    expect(makeBuilder('dmg').getFileName()).toMatch(/^Demo_.+/);
  });

  it('defaults to a DMG when no target is given', () => {
    expect(makeBuilder(undefined).getFileName()).toMatch(/^Demo_.+/);
  });

  it('keeps treating arch values as DMG builds with an arch suffix', () => {
    expect(makeBuilder('apple').getFileName()).toMatch(/_aarch64$/);
    expect(makeBuilder('intel').getFileName()).toMatch(/_x64$/);
    expect(makeBuilder('universal').getFileName()).toMatch(/_universal$/);
  });
});
