// gspot explain
import type { Command } from 'commander';
import { explain } from '#cli/output/explain.ts';
import { openSession } from '#cli/run/session.ts';
import type { CommandResult } from '#types/run.ts';
import { directoryOf } from '#cli/commands/flags.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { hasPolicy } from '#cli/policy/read-policy.ts';
import { printCommand } from '#cli/commands/print-result.ts';

async function explainResult(directory: string, subject: string): Promise<CommandResult> {
    const root = findRoot(directory);
    const session = hasPolicy(root) ? await openSession(root) : undefined;
    const result = explain(session, subject);
    if ('error' in result) return { text: `${result.error}\n`, json: result, exitCode: 2 };
    return { text: result.text, json: { kind: result.kind, subject: result.subject, ...result.data }, exitCode: 0 };
}

/**
 * Registers explain.
 * @param program the commander program
 */
export function registerExplain(program: Command): void {
    program
        .command('explain <subject>')
        .description('Say what a check, a tool rule, a preset or a setting is, in plain words')
        .action(async (subject: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => explainResult(directoryOf(global), subject), global);
        });
}
