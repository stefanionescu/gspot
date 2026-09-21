// gspot set
import type { Command } from 'commander';
import { setCommand } from '#cli/policy/set-command.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers set.
 * @param program the commander program
 */
export function registerSet(program: Command): void {
    program
        .command('set <key> [value...]')
        .description('Write one setting; the key is the dotted path gspot list settings prints')
        .option('--reason <text>', 'Optional explanation; require_reasons makes it required for loosening changes')
        .option('--scope <path>', 'Write into a scope table instead of the root')
        .option('--replace', 'For a list: replace the whole list')
        .option('--remove', 'For a list: remove the named items')
        .option('--default', 'Delete the key so the shipped default applies again')
        .action(async (key: string, items: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    setCommand({
                        cwd: directoryOf(global),
                        key,
                        items,
                        replace: flags['replace'] === true,
                        remove: flags['remove'] === true,
                        toDefault: flags['default'] === true,
                        ...textEntry(flags, 'reason', 'reason'),
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}
