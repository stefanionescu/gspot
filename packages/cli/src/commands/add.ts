// gspot add
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { addCommand } from '#cli/policy/commands.ts';

/** Registers add. */
export function registerAdd(program: Command): void {
    program
        .command('add <preset...>')
        .description('Add presets to the root selection, or to one scope')
        .option('--scope <path>', 'The scope to add them to')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (presets: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(
                () =>
                    addCommand({
                        cwd: String(global['directory'] ?? process.cwd()),
                        presets,
                        dryRun: Boolean(flags['dryRun']),
                        ...(flags['scope'] ? { scope: String(flags['scope']) } : {}),
                    }),
                global,
            );
        });
}
