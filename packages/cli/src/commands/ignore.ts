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
        .addHelpText(
            'after',
            '\nEffects:\nWrites a policy exception and applies configuration. Select the check and optional rule or paths. When require_reasons is true, a meaningful reason is required.\n\nExit codes:\n0: the exception change was applied. 2: invalid input or inability to complete the request.\n\nExample:\ngspot ignore bash/syntax --paths scripts/example.sh --reason "The file is a syntax-error fixture."',
        )
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
