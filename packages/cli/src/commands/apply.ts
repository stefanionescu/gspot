// gspot apply
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { applyCommand } from '#cli/emit/apply.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import { directoryOf } from '#cli/commands/flags.ts';

/**
 * Registers apply.
 * @param program the commander program
 */
export function registerApply(program: Command): void {
    program
        .command('apply')
        .description('Re-render every generated file from gspot.toml; idempotent')
        .option('--check', 'Render in memory and fail with a diff when a generated file differs')
        .option('--baseline', "Lower every baseline to the last run's counts; never raise one")
        .option('--project-templates', 'Copy the project templates that match into the project rule layer, once')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            const binary = binaryPath();
            await emit(
                () =>
                    applyCommand({
                        cwd: directoryOf(global),
                        check: flags['check'] === true,
                        baseline: flags['baseline'] === true,
                        projectTemplates: flags['projectTemplates'] === true,
                        ...(binary === undefined ? {} : { binaryPath: binary }),
                    }),
                global,
            );
        });
}
