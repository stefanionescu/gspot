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
        .option('--project-templates', 'Copy the project templates that match into the project rule layer, once')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    applyCommand({
                        cwd: directoryOf(global),
                        check: flags['check'] === true,
                        lowerBaselines: flags['lowerBaselines'] === true,
                        projectTemplates: flags['projectTemplates'] === true,
                    }),
                global,
            );
        });
}
