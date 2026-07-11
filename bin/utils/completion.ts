import type { Command } from 'commander';
import { NewCommand } from '@gutenye/commander-completion-carapace';

export type CompletionCommand = Command & {
  enableCompletion(): CompletionCommand;
  installCompletion(): Promise<void>;
};

export const completionProgram = new NewCommand() as CompletionCommand;
