import tab from '@bomb.sh/tab/commander';
import type { Command } from 'commander';

/**
 * Adds the completion command to a program. Called after every other command is registered, because tab walks the tree.
 * @param program the commander program
 */
export function installCompletion(program: Command): void {
    tab(program, { completionCommandName: 'completion' });
    const completion = program.commands.find((command) => command.name() === 'completion');
    completion
        ?.summary('Print a shell completion script')
        .description('Print the completion script for bash, zsh, fish, or PowerShell')
        .addHelpText(
            'after',
            '\nEffects:\nPrints the completion script for the shell. Save it to a file and load that file in your shell to turn on completion.\n\nExit codes:\n- 0: the script was printed.\n- 2: the input was invalid, or completion could not finish.\n\nExample:\ngspot completion bash',
        );
}
