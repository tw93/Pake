import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalConfigHome = process.env.XDG_CONFIG_HOME;

afterEach(() => {
  if (originalConfigHome === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = originalConfigHome;
  }
  vi.resetModules();
});

describe('shell completion', () => {
  it('generates a Carapace spec from every Commander option', async () => {
    const configHome = await mkdtemp(join(tmpdir(), 'pake-completion-'));
    process.env.XDG_CONFIG_HOME = configHome;
    vi.resetModules();

    try {
      const { getCliProgram } =
        await import('../../bin/helpers/cli-program.js');
      const program = getCliProgram();

      await program.installCompletion();

      const spec = await readFile(
        join(configHome, 'carapace', 'specs', 'pake.yaml'),
        'utf8',
      );
      expect(spec).toContain('name: pake');

      for (const option of program.options) {
        expect(spec).toContain(option.long ?? option.short);
      }
    } finally {
      await rm(configHome, { recursive: true, force: true });
    }
  });
});
