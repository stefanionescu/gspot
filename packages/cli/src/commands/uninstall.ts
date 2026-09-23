// gspot uninstall
import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { uninstallCommand } from '#cli/lifecycle/uninstall-command.ts';

/**
 * Registers uninstall.
 * @param program the commander program
 */
export function registerUninstall(program: Command): void {
    program
        .command('uninstall')
        .description('Remove what init wrote; keep gspot.toml and the project rule layer')
        .addHelpText(
            'after',
            '\nEffects:\nShows managed removals and restorations, then applies them after confirmation or --yes. --dry-run writes nothing. Edited or unowned files are preserved. gspot.toml and recovery data remain available.\n\nExit codes:\n0: the request completed, including a preview or declined confirmation. 2: invalid input or inability to complete the request.\n\nExample:\ngspot uninstall --dry-run',
        )
        .option('--yes', 'Skip the question')
        .option('--dry-run', 'Print the plan and remove nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    uninstallCommand({
                        cwd: directoryOf(global),
                        yes: flags['yes'] === true,
                        isDryRun: flags['dryRun'] === true,
                    }),
                global,
            );
        });
}
