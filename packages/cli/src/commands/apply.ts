// gspot sync
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import { syncCommand } from '#cli/render/sync-command.ts';

/** Registers sync. */
export function registerSync(program: Command): void {
    program
        .command('sync')
        .description('Re-render every generated file from gspot.toml; idempotent')
        .option('--check', 'Render in memory and fail with a diff when a generated file differs')
        .option('--baseline', "Lower every baseline to the last run's counts; never raise one")
        .option('--project-templates', 'Copy the project templates that match into the project rule layer, once')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            const binary = binaryPath();
            await emit(
                () =>
                    syncCommand({
                        cwd: String(global['directory'] ?? process.cwd()),
                        check: Boolean(flags['check']),
                        baseline: Boolean(flags['baseline']),
                        projectTemplates: Boolean(flags['projectTemplates']),
                        ...(binary !== undefined ? { binaryPath: binary } : {}),
                    }),
                global,
            );
        });
}
