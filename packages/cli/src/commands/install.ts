import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { installCommand } from '#cli/lifecycle/install-command.ts';

/** Register immutable installation for a clone. */
export function registerInstall(program: Command): void {
    program
        .command('install')
        .description('Install locked tools for this clone without changing tracked configuration')
        .option('--dry-run', 'Preview installation commands without writing files')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () => installCommand({ cwd: directoryOf(global), isDryRun: flags['dryRun'] === true }),
                global,
            );
        });
}
