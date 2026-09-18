// gspot explain
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { explain } from '#cli/output/explain.ts';
import { hasPolicy } from '#cli/policy/load.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/run/session.ts';

/** Registers explain. */
export function registerExplain(program: Command): void {
    program
        .command('explain <subject>')
        .description('Say what a check, a tool rule, a preset or a setting is, in plain words')
        .action(async (subject: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(async () => {
                const root = findRoot(String(global['directory'] ?? process.cwd()));
                const session = hasPolicy(root) ? await openSession(root) : undefined;
                const result = explain(session, subject);
                if ('error' in result) return { text: `${result.error}\n`, json: result, exitCode: 2 };
                return {
                    text: result.text,
                    json: { kind: result.kind, subject: result.subject, ...result.data },
                    exitCode: 0,
                };
            }, global);
        });
}
