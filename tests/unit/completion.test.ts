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
  it('generates standalone integrations and a Carapace spec', async () => {
    const configHome = await mkdtemp(join(tmpdir(), 'pake-completion-'));
    process.env.XDG_CONFIG_HOME = configHome;
    vi.resetModules();

    try {
      const { getCliProgram } =
        await import('../../bin/helpers/cli-program.js');
      const { COMPLETION_SHELLS, generateShellCompletion } =
        await import('../../bin/utils/completion.js');
      const program = getCliProgram();

      for (const shell of COMPLETION_SHELLS) {
        const completion = generateShellCompletion(program, shell);
        expect(completion).not.toContain('carapace');
        for (const option of program.options) {
          if (!option.long) continue;
          const flag =
            shell === 'fish' ? `-l ${option.long.slice(2)}` : option.long;
          expect(completion).toContain(flag);
        }
      }

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
