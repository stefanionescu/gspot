// gspot completion
import type { Command } from 'commander';

import { installCompletion } from '#cli/output/completion.ts';

/** Registers completion; must run after every other command is registered. */
export function registerCompletion(program: Command): void {
    installCompletion(program);
}
