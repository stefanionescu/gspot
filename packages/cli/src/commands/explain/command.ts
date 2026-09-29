import type { Command } from 'commander';
import { hasPolicy } from '#cli/policy/read.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/execution/session.ts';
import { directoryOf } from '#cli/platform/arguments.ts';
import type { CommandResult } from '#cli/types/commands.ts';
import { explain } from '#cli/commands/explain/subjects.ts';
import { printCommand } from '#cli/commands/print-result.ts';

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
        .summary('Explain a check, rule, kit, setting, or file')
        .description('Explain a check, a tool rule, a kit, a setting, or a file path')
        .addHelpText(
            'after',
            '\nEffects:\nPrints what the subject is and what to do about it. A rule also gets the gspot ignore and gspot set lines that change it. A setting gets its value, its default, and where the value comes from. A file gets the checks that read it. explain changes nothing.\n\nExit codes:\n- 0: the explanation was printed.\n- 2: the subject is unknown, or the input was invalid.\n\nExample:\ngspot explain bash/syntax',
        )
        .action(async (subject: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => explainResult(directoryOf(global), subject), global);
        });
}
