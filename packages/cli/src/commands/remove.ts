// gspot remove
import type { Command } from 'commander';
import { removeCommand } from '#cli/policy/add-command.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { directoryOf, textEntry } from '#cli/commands/flags.ts';

/**
 * Registers remove.
 * @param program the commander program
 */
export function registerRemove(program: Command): void {
    program
        .command('remove <preset>')
        .description('Remove a preset from the root selection, or from one scope')
        .addHelpText(
            'after',
            '\nEffects:\nRemoves the named preset from the root or --scope selection and applies configuration. Removal is refused when another selected preset requires it. Installs the tools required by the remaining selection. --dry-run previews the policy change without applying or installing it.\n\nExit codes:\n0: the preset was removed, or the preview completed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot remove bash --dry-run',
        )
        .option('--scope <path>', 'The scope to remove it from')
        .option('--dry-run', 'Print what would be written and write nothing')
        .action(async (preset: string, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    removeCommand({
                        cwd: directoryOf(global),
                        preset,
                        isDryRun: flags['dryRun'] === true,
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}
