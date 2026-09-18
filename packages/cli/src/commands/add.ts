// gspot add
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { addCommand } from '#cli/policy/commands.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers add.
 * @param program the commander program
 */
export function registerAdd(program: Command): void {
    program
        .command('add <preset...>')
        .description('Add presets to the root selection, or to one scope')
        .option('--scope <path>', 'The scope to add them to')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (presets: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(
                () =>
                    addCommand({
                        cwd: directoryOf(global),
                        presets,
                        isDryRun: flags['dryRun'] === true,
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}
