import type { Command } from 'commander';
import { explain } from '#cli/commands/explain/subjects.ts';
import { openSession } from '#cli/execution/session.ts';
import { directoryOf } from '#cli/commands/flags.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { hasPolicy } from '#cli/policy/read-policy.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';

async function explainResult(directory: string, subject: string): Promise<CommandResult> {
    const root = findRoot(directory);
    const session = hasPolicy(root) ? await openSession(root) : undefined;
    const result = explain(session, subject);
    if ('error' in result) return { text: `${result.error}\n`, json: result, exitCode: 2 };
    return { text: result.text, json: { ...result.data, kind: result.kind, subject: result.subject }, exitCode: 0 };
}

/**
 * Registers explain.
 * @param program the commander program
 */
export function registerExplain(program: Command): void {
    program
        .command('explain <subject>')
        .summary('Explain a check or setting')
        .description('Say what a check, a tool rule, a configuration, a setting, or a file path is, in plain words')
        .addHelpText(
            'after',
            '\nEffects:\nReads definitions or file ownership and prints the requested explanation. It does not change policy or run the repository gate. An unknown subject is an inability to complete the request.\n\nExit codes:\n0: the explanation was printed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot explain bash/syntax',
        )
        .action(async (subject: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => explainResult(directoryOf(global), subject), global);
        });
}
