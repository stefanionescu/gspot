// gspot set
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { setCommand } from '#cli/policy/set-command.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers set.
 * @param program the commander program
 */
export function registerSet(program: Command): void {
    program
        .command('set <key> [value...]')
        .description('Write one setting; the key is the dotted path gspot doctor --settings prints')
        .option('--reason <text>', 'Why; required when the change loosens a rule')
        .option('--scope <path>', 'Write into a scope table instead of the root')
        .option('--replace', 'For a list: replace the whole list')
        .option('--remove', 'For a list: remove the named items')
        .option('--default', 'Delete the key so the shipped default applies again')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (key: string, items: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(
                () =>
                    setCommand({
                        cwd: directoryOf(global),
                        key,
                        items,
                        replace: flags['replace'] === true,
                        remove: flags['remove'] === true,
                        toDefault: flags['default'] === true,
                        isDryRun: flags['dryRun'] === true,
                        ...textEntry(flags, 'reason', 'reason'),
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}
