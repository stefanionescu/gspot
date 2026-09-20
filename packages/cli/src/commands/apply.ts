// gspot apply
import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { applyCommand } from '#cli/emit/apply-command.ts';
import { printCommand } from '#cli/commands/print-result.ts';

/**
 * Registers apply.
 * @param program the commander program
 */
export function registerApply(program: Command): void {
    program
        .command('apply')
        .description('Re-render every generated file from gspot.toml; idempotent')
        .option('--check', 'Render in memory and fail with a diff when a generated file differs')
        .option('--lower-baselines', "Lower every baseline to the last run's counts; never raise one")
        .option(
            '--baseline <check-id>',
            'Write the first baseline of one check; a baseline that exists is never raised',
        )
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    applyCommand({
                        cwd: directoryOf(global),
                        check: flags['check'] === true,
                        lowerBaselines: flags['lowerBaselines'] === true,
                        baseline: typeof flags['baseline'] === 'string' ? flags['baseline'] : undefined,
                    }),
                global,
            );
        });
}
