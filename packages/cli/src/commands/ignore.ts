// gspot ignore
import type { Command } from 'commander';
import { printCommand } from '#cli/commands/print-result.ts';
import { ignoreCommand } from '#cli/policy/ignore-command.ts';
import { directoryOf, listFlag, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers ignore.
 * @param program the commander program
 */
export function registerIgnore(program: Command): void {
    program
        .command('ignore <check>')
        .description('Turn a check, or one rule in it, off for some paths or everywhere')
        .option('--paths <glob...>', 'The paths the ignore applies to; none means the whole scope')
        .option('--rule <rule>', 'One rule inside the check')
        .option('--reason <text>', 'Optional explanation; required when require_reasons is true')
        .option('--remove', 'Delete the matching entry instead')
        .action(async (check: string, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            const paths = listFlag(flags, 'paths');
            await printCommand(
                () =>
                    ignoreCommand({
                        cwd: directoryOf(global),
                        check,
                        remove: flags['remove'] === true,
                        ...(paths === undefined ? {} : { paths }),
                        ...textEntry(flags, 'rule', 'rule'),
                        ...textEntry(flags, 'reason', 'reason'),
                    }),
                global,
            );
        });
}
