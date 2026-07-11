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
      const {
        COMPLETION_SHELLS,
        addCompletionCommands,
        generateShellCompletion,
        installShellCompletion,
      } = await import('../../bin/utils/completion.js');
      const program = getCliProgram();
      addCompletionCommands(program);
      const options = program.createHelp().visibleOptions(program);

      for (const shell of COMPLETION_SHELLS) {
        const completion = generateShellCompletion(program, shell);
        expect(completion).not.toContain('carapace');
        expect(completion).toContain('completion');
        expect(completion).toContain('install-completion');
        for (const option of options) {
          if (!option.long) continue;
          const flag =
            shell === 'fish' ? `-l ${option.long.slice(2)}` : option.long;
          expect(completion).toContain(flag);
        }
        const positionalMarker = {
          bash: 'compgen -f',
          zsh: 'URL or local file:_files',
          fish: "-d 'URL or local file'",
          nushell: 'url?: path # URL or local file',
        }[shell];
        expect(completion).toContain(positionalMarker);

        const installOptions = {
          homeDir: configHome,
          env: {
            XDG_CONFIG_HOME: join(configHome, 'config'),
            XDG_DATA_HOME: join(configHome, 'data'),
          },
        };
        const installedPath = await installShellCompletion(
          program,
          shell,
          installOptions,
        );
        await installShellCompletion(program, shell, installOptions);
        expect(await readFile(installedPath, 'utf8')).toBe(completion);
      }

      const bashrc = await readFile(join(configHome, '.bashrc'), 'utf8');
      expect(bashrc.match(/pake\.bash/g)).toHaveLength(1);
      const zshrc = await readFile(join(configHome, '.zshrc'), 'utf8');
      expect(zshrc.match(/_pake/g)).toHaveLength(1);
      const nuConfig = await readFile(
        join(configHome, 'config', 'nushell', 'config.nu'),
        'utf8',
      );
      expect(nuConfig.match(/pake-completion\.nu/g)).toHaveLength(1);

      await program.installCompletion();

      const spec = await readFile(
        join(configHome, 'carapace', 'specs', 'pake.yaml'),
        'utf8',
      );
      expect(spec).toContain('name: pake');
      expect(spec).toContain('commands:');
      expect(spec).toContain('$files');

      for (const option of options) {
        expect(spec).toContain(option.long ?? option.short);
      }
      for (const shell of COMPLETION_SHELLS) {
        expect(spec).toContain(`- ${shell}`);
      }
    } finally {
      await rm(configHome, { recursive: true, force: true });
    }
  });
});
