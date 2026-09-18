// gspot uninstall
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { uninstallCommand } from '#cli/render/uninstall-command.ts';

/** Registers uninstall. */
export function registerUninstall(program: Command): void {
    program
        .command('uninstall')
        .description('Remove what init wrote; keep gspot.toml and the project rule layer')
        .option('--keep-hooks', 'Leave core.hooksPath as it is')
        .option('--yes', 'Skip the question')
        .option('--dry-run', 'Print the plan and remove nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(
                () =>
                    uninstallCommand({
                        cwd: String(global['directory'] ?? process.cwd()),
                        keepHooks: Boolean(flags['keepHooks']),
                        yes: Boolean(flags['yes']),
                        dryRun: Boolean(flags['dryRun']),
                    }),
                global,
            );
        });
}
