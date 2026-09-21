// gspot upgrade
import type { Command } from 'commander';
import { printCommand } from '#cli/commands/print-result.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';
import { upgradeCommand } from '#cli/lifecycle/upgrade/command.ts';

/**
 * Registers upgrade.
 * @param program the commander program
 */
export function registerUpgrade(program: Command): void {
    program
        .command('upgrade')
        .description(
            'Move this repository to this gspot version: preview the changes and update generated configuration',
        )
        .option('--dry-run', 'Print the report and write nothing')
        .option('--to <version>', 'Move to an exact version with a supported migration')
        .option('--yes', 'Skip the question')
        .option('--no-install', 'Skip the install step and print the command instead')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    upgradeCommand({
                        cwd: directoryOf(global),
                        isDryRun: flags['dryRun'] === true,
                        yes: flags['yes'] === true,
                        install: flags['install'] !== false,
                        ...textEntry(flags, 'to', 'to'),
                    }),
                global,
            );
        });
}
