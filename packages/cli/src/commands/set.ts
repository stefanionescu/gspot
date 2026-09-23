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
        .addHelpText(
            'after',
            '\nEffects:\nValidates and writes the setting to gspot.toml, then applies generated configuration. --scope writes to an existing scope. Lists append by default; --replace replaces the written list and --remove removes written entries. --default deletes the written key so inherited or shipped values apply. It does not install tools.\n\nExit codes:\n0: the setting change was applied. 2: invalid input or inability to complete the request.\n\nExample:\ngspot set level all',
        )
        .option('--reason <text>', 'Optional explanation; require_reasons makes it required for loosening changes')
        .option('--scope <path>', 'Write into a scope table instead of the root')
        .option('--replace', 'For a list: replace the whole list')
        .option('--remove', 'For a list: remove the named items')
        .option('--default', 'Delete the written key so inherited or shipped values apply')
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
