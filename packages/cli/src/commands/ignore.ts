// gspot ignore
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { ignoreCommand } from '#cli/policy/commands.ts';
import { directoryOf, listFlag, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers ignore.
 * @param program the commander program
 */
export function registerIgnore(program: Command): void {
    program
        .command('ignore <check-id>')
        .description('Turn a check, or one rule in it, off for some paths or everywhere, with a reason')
        .option('--paths <glob...>', 'The paths the ignore applies to; none means the whole scope')
        .option('--rule <rule>', 'One rule inside the check')
        .option('--reason <text>', 'Why; required, and printed on every run')
        .option('--remove', 'Delete the matching entry instead')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (checkId: string, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            const paths = listFlag(flags, 'paths');
            await emit(
                () =>
                    ignoreCommand({
                        cwd: directoryOf(global),
                        check: checkId,
                        remove: flags['remove'] === true,
                        isDryRun: flags['dryRun'] === true,
                        ...(paths === undefined ? {} : { paths }),
                        ...textEntry(flags, 'rule', 'rule'),
                        ...textEntry(flags, 'reason', 'reason'),
                    }),
                global,
            );
        });
}
