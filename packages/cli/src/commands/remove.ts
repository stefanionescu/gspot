// gspot remove
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { removeCommand } from '#cli/policy/commands.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers remove.
 * @param program the commander program
 */
export function registerRemove(program: Command): void {
    program
        .command('remove <preset>')
        .description('Remove a preset from the root selection, or from one scope')
        .option('--scope <path>', 'The scope to remove it from')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (preset: string, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(
                () =>
                    removeCommand({
                        cwd: directoryOf(global),
                        preset,
                        isDryRun: flags['dryRun'] === true,
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}
