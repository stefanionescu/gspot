// gspot profile
import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { profileCheckCommand, profileSaveCommand } from '#cli/profile/command.ts';

/**
 * Registers profile with its two subcommands.
 * @param program the commander program
 */
export function registerProfile(program: Command): void {
    const profile = program
        .command('profile')
        .description('Carry a policy between repositories: save one from here, or check one before init --from');
    profile
        .command('save <file>')
        .description('Write a profile from the policy of this repository, without anything that names a path')
        .action(async (file: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => profileSaveCommand(directoryOf(global), file), global);
        });
    profile
        .command('check <profile>')
        .description('Load and validate a profile from a path, an https URL or github:owner/repo')
        .action(async (source: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => profileCheckCommand(directoryOf(global), source), global);
        });
}
