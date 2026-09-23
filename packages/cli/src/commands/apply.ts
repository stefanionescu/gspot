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
        .addHelpText(
            'after',
            '\nEffects:\nReads gspot.toml and regenerates owned configuration, rule copies, and selected integrations. Authored or edited files remain subject to ownership validation. --dry-run previews the proposal without writing project files. This command does not install newly selected tools.\n\nExit codes:\n0: configuration was applied, or the preview completed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot apply --dry-run',
        )
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
