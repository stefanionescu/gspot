// gspot remove
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { removeCommand } from '#cli/policy/commands.ts';

/** Registers remove. */
export function registerRemove(program: Command): void {
    program
        .command('remove <preset>')
        .description('Remove a preset from the root selection, or from one scope')
        .option('--scope <path>', 'The scope to remove it from')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (preset: string, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(
                () =>
                    removeCommand({
                        cwd: String(global['directory'] ?? process.cwd()),
                        preset,
                        dryRun: Boolean(flags['dryRun']),
                        ...(flags['scope'] ? { scope: String(flags['scope']) } : {}),
                    }),
                global,
            );
        });
}
