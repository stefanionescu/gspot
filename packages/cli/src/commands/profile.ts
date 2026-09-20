// gspot profile
import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { profileSaveCommand } from '#cli/profile/command.ts';

/**
 * Registers profile save.
 * @param program the commander program
 */
export function registerProfile(program: Command): void {
    const profile = program.command('profile').description('Save a policy profile for another repository');
    profile
        .command('save <file>')
        .description('Write a profile from the policy of this repository, without anything that names a path')
        .action(async (file: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => profileSaveCommand(directoryOf(global), file), global);
        });
}
