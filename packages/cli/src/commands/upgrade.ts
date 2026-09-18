// gspot upgrade
import type { Command } from 'commander';
import { binaryPath } from '#cli/platform/assets.ts';
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
            'Move this repository to this gspot version: report the changes, ask, re-render, baseline what arrives',
        )
        .option('--check', 'Print the report and write nothing')
        .option('--to <version>', 'Move to an exact version, downward included')
        .option('--yes', 'Skip the question')
        .option('--no-install', 'Skip the install step and print the command instead')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            const binary = binaryPath();
            await printCommand(
                () =>
                    upgradeCommand({
                        cwd: directoryOf(global),
                        check: flags['check'] === true,
                        yes: flags['yes'] === true,
                        install: flags['install'] !== false,
                        ...textEntry(flags, 'to', 'to'),
                        ...(binary === undefined ? {} : { binaryPath: binary }),
                    }),
                global,
            );
        });
}
