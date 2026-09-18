// gspot upgrade
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import { binaryPath } from '#cli/platform/assets.ts';
import { upgradeCommand } from '#cli/emit/upgrade.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';

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
            await emit(
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
