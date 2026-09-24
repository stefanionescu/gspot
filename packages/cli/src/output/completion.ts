// gspot completion <shell>: the script tab generates from the commander tree.
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
        ?.summary('Set up shell completion')
        .description('Print the shell completion script for bash, zsh, fish, or powershell')
        .addHelpText(
            'after',
            '\nEffects:\nPrints a completion script for the chosen shell. Redirect the output to a file and load it using that shell to enable completion. Printing the script does not install it.\n\nExit codes:\n0: the completion script was printed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot completion bash',
        );
}
