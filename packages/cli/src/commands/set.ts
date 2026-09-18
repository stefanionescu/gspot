// gspot set
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { setCommand } from '#cli/policy/commands.ts';

/** Registers set. */
export function registerSet(program: Command): void {
    program
        .command('set <key> [value...]')
        .description('Write one setting; the key is the dotted path gspot doctor --settings prints')
        .option('--reason <text>', 'Why; required when the change loosens a rule')
        .option('--scope <path>', 'Write into a scope table instead of the root')
        .option('--replace', 'For a list: replace the whole list')
        .option('--remove', 'For a list: remove the named values')
        .option('--default', 'Delete the key so the shipped default applies again')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (key: string, values: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(
                () =>
                    setCommand({
                        cwd: String(global['directory'] ?? process.cwd()),
                        key,
                        values,
                        replace: Boolean(flags['replace']),
                        remove: Boolean(flags['remove']),
                        toDefault: Boolean(flags['default']),
                        dryRun: Boolean(flags['dryRun']),
                        ...(flags['reason'] !== undefined ? { reason: String(flags['reason']) } : {}),
                        ...(flags['scope'] ? { scope: String(flags['scope']) } : {}),
                    }),
                global,
            );
        });
}
