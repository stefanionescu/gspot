// gspot allow
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { allowCommand } from '#cli/policy/commands.ts';

/** Registers allow. */
export function registerAllow(program: Command): void {
    program
        .command('allow <list> <value...>')
        .description('Add to an allow list: typos, typos-exclude, licenses, naming, naming-external, gitleaks or osv')
        .option('--reason <text>', 'Why; required for every list but typos words')
        .option('--license <spdx>', 'For licenses: the license the package reports')
        .option('--remove', 'Delete the matching entry instead')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (list: string, values: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(
                () =>
                    allowCommand({
                        cwd: String(global['directory'] ?? process.cwd()),
                        list,
                        values,
                        remove: Boolean(flags['remove']),
                        dryRun: Boolean(flags['dryRun']),
                        ...(flags['reason'] !== undefined ? { reason: String(flags['reason']) } : {}),
                        ...(flags['license'] ? { license: String(flags['license']) } : {}),
                    }),
                global,
            );
        });
}
