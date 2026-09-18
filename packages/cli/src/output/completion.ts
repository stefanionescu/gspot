// gspot completion <shell>: the script tab generates from the commander tree.
import type { Command } from 'commander';
import tab from '@bomb.sh/tab/commander';

/** Adds the completion command to a program. Called after every other command is registered, because tab walks the tree. */
export function installCompletion(program: Command): void {
    tab(program, { completionCommandName: 'completion' });
    const completion = program.commands.find((command) => command.name() === 'completion');
    completion?.description('Print the shell completion script for bash, zsh, fish or powershell');
}
