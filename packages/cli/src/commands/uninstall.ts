// gspot uninstall
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { directoryOf } from '#cli/commands/flags.ts';
import { uninstallCommand } from '#cli/emit/uninstall.ts';

/**
 * Registers uninstall.
 * @param program the commander program
 */
export function registerUninstall(program: Command): void {
    program
        .command('uninstall')
        .description('Remove what init wrote; keep gspot.toml and the project rule layer')
        .option('--keep-hooks', 'Leave core.hooksPath as it is')
        .option('--yes', 'Skip the question')
        .option('--dry-run', 'Print the plan and remove nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(
                () =>
                    uninstallCommand({
                        cwd: directoryOf(global),
                        isHooksKept: flags['keepHooks'] === true,
                        yes: flags['yes'] === true,
                        isDryRun: flags['dryRun'] === true,
                    }),
                global,
            );
        });
}
