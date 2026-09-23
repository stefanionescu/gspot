import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { installCommand } from '#cli/lifecycle/install-command.ts';

/** Register immutable installation for a clone. */
export function registerInstall(program: Command): void {
    program
        .command('install')
        .description('Install locked tools for this clone without changing tracked configuration')
        .addHelpText(
            'after',
            '\nEffects:\nInstalls the locked tools selected by gspot.toml into the managed installation. It also installs selected hooks. It does not choose presets. Use this after cloning a configured repository. A failed dependency installation preserves its previous tree. Completed setup steps can remain if a later step fails. --dry-run previews installation commands without writing files.\n\nExit codes:\n0: installation or its preview completed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot install --dry-run',
        )
        .option('--dry-run', 'Preview installation commands without writing files')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () => installCommand({ cwd: directoryOf(global), isDryRun: flags['dryRun'] === true }),
                global,
            );
        });
}
