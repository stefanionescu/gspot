// gspot allow
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { allowCommand } from '#cli/policy/allow-command.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers allow.
 * @param program the commander program
 */
export function registerAllow(program: Command): void {
    program
        .command('allow <list> <value...>')
        .description('Add to an allow list: typos, typos-exclude, licenses, naming, naming-external, gitleaks or osv')
        .option('--reason <text>', 'Why; required for every list but typos words')
        .option('--license <spdx>', 'For licenses: the license the package reports')
        .option('--remove', 'Delete the matching entry instead')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (list: string, items: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(
                () =>
                    allowCommand({
                        cwd: directoryOf(global),
                        list,
                        items,
                        remove: flags['remove'] === true,
                        isDryRun: flags['dryRun'] === true,
                        ...textEntry(flags, 'reason', 'reason'),
                        ...textEntry(flags, 'license', 'license'),
                    }),
                global,
            );
        });
}
