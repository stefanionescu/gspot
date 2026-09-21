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
        .description('Generate configuration from gspot.toml')
        .option('--dry-run', 'Preview proposed changes without writing project files')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    applyCommand({
                        cwd: directoryOf(global),
                        isDryRun: flags['dryRun'] === true,
                    }),
                global,
            );
        });
}
