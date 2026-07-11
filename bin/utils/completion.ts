import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Command, Option } from 'commander';
import { NewCommand } from '@gutenye/commander-completion-carapace';

export const COMPLETION_SHELLS = ['bash', 'zsh', 'fish', 'nushell'] as const;
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

export type CompletionCommand = Command & {
  enableCompletion(): CompletionCommand;
  installCompletion(): Promise<void>;
};

export const completionProgram = new NewCommand() as CompletionCommand;

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function visibleFlags(program: Command) {
  return program.options.flatMap((option) =>
    [option.short, option.long].filter((flag): flag is string => Boolean(flag)),
  );
}

function bashCompletion(program: Command) {
  const flags = visibleFlags(program).join(' ');
  const shells = COMPLETION_SHELLS.join(' ');
  return `# bash completion for pake
_pake_completion() {
  local current="\${COMP_WORDS[COMP_CWORD]}"
  if [[ "\${COMP_WORDS[1]}" == "completion" || "\${COMP_WORDS[1]}" == "install-completion" ]]; then
    COMPREPLY=( $(compgen -W ${shellQuote(shells)} -- "$current") )
  elif [[ "$current" == -* ]]; then
    COMPREPLY=( $(compgen -W ${shellQuote(flags)} -- "$current") )
  fi
}
complete -F _pake_completion pake
`;
}

function zshCompletion(program: Command) {
  const flags = visibleFlags(program).map(shellQuote).join(' ');
  const shells = COMPLETION_SHELLS.map(shellQuote).join(' ');
  return `#compdef pake
_pake() {
  if [[ "\${words[2]}" == "completion" || "\${words[2]}" == "install-completion" ]]; then
    compadd -- ${shells}
  elif [[ "\${words[CURRENT]}" == -* ]]; then
    compadd -- ${flags}
  fi
}
compdef _pake pake
`;
}

function fishOption(option: Option) {
  const flags = [
    option.short ? `-s ${option.short.slice(1)}` : '',
    option.long ? `-l ${option.long.slice(2)}` : '',
    option.isBoolean() ? '' : '-r',
    option.description ? `-d ${shellQuote(option.description)}` : '',
  ].filter(Boolean);
  return `complete -c pake ${flags.join(' ')}`;
}

function fishCompletion(program: Command) {
  const options = program.options.map(fishOption).join('\n');
  return `# fish completion for pake
complete -c pake -f -a completion -d 'Generate standalone shell completion'
complete -c pake -f -a install-completion -d 'Install standalone shell completion'
complete -c pake -f -n '__fish_seen_subcommand_from completion' -a '${COMPLETION_SHELLS.join(' ')}'
complete -c pake -f -n '__fish_seen_subcommand_from install-completion' -a '${COMPLETION_SHELLS.join(' ')}'
${options}
`;
}

function nushellFlag(option: Option) {
  const long = option.long?.slice(2);
  if (!long) return undefined;
  const short = option.short ? `(-${option.short.slice(1)})` : '';
  const value = option.isBoolean() ? '' : ': string';
  const description = option.description
    ? ` # ${option.description.replace(/\n/g, ' ')}`
    : '';
  return `  --${long}${short}${value}${description}`;
}

function nushellCompletion(program: Command) {
  const flags = program.options
    .map(nushellFlag)
    .filter((flag): flag is string => Boolean(flag))
    .join('\n');
  return `# Nushell completion for pake
export extern pake [
  url?: string
${flags}
]

def "nu-complete pake shells" [] {
  [${COMPLETION_SHELLS.map(shellQuote).join(' ')}]
}

export extern "pake completion" [
  shell: string@"nu-complete pake shells"
]

export extern "pake install-completion" [
  shell: string@"nu-complete pake shells"
]
`;
}

export function generateShellCompletion(
  program: Command,
  shell: CompletionShell,
) {
  switch (shell) {
    case 'bash':
      return bashCompletion(program);
    case 'zsh':
      return zshCompletion(program);
    case 'fish':
      return fishCompletion(program);
    case 'nushell':
      return nushellCompletion(program);
  }
}

type InstallCompletionOptions = {
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
};

async function appendLoader(configPath: string, loader: string) {
  let current = '';
  try {
    current = await readFile(configPath, 'utf8');
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
    ) {
      throw error;
    }
  }
  if (current.includes(loader)) return;

  await mkdir(path.dirname(configPath), { recursive: true });
  const prefix = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
  await appendFile(configPath, `${prefix}${loader}\n`);
}

export async function installShellCompletion(
  program: Command,
  shell: CompletionShell,
  options: InstallCompletionOptions = {},
) {
  const homeDir = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;
  const configHome = env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config');
  const dataHome = env.XDG_DATA_HOME ?? path.join(homeDir, '.local', 'share');
  const completion = generateShellCompletion(program, shell);

  let completionPath: string;
  let configPath: string | undefined;
  let loader: string | undefined;

  switch (shell) {
    case 'bash':
      completionPath = path.join(dataHome, 'pake', 'completions', 'pake.bash');
      configPath = path.join(homeDir, '.bashrc');
      loader = `. ${shellQuote(completionPath)}`;
      break;
    case 'zsh': {
      completionPath = path.join(dataHome, 'pake', 'completions', '_pake');
      configPath = path.join(env.ZDOTDIR ?? homeDir, '.zshrc');
      loader = `. ${shellQuote(completionPath)}`;
      break;
    }
    case 'fish':
      completionPath = path.join(
        configHome,
        'fish',
        'completions',
        'pake.fish',
      );
      break;
    case 'nushell':
      completionPath = path.join(configHome, 'nushell', 'pake-completion.nu');
      configPath = path.join(configHome, 'nushell', 'config.nu');
      loader = `source "${completionPath.replace(/(["\\])/g, '\\$1')}"`;
      break;
  }

  await mkdir(path.dirname(completionPath), { recursive: true });
  await writeFile(completionPath, completion);
  if (configPath && loader) await appendLoader(configPath, loader);

  return completionPath;
}
