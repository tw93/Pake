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
  if [[ "\${COMP_WORDS[1]}" == "completion" ]]; then
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
  if [[ "\${words[2]}" == "completion" ]]; then
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
complete -c pake -f -n '__fish_seen_subcommand_from completion' -a '${COMPLETION_SHELLS.join(' ')}'
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
