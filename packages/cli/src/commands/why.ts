// gspot why
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { renderWhy, why } from '#cli/output/why.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/run/session.ts';

/** Registers why. */
export function registerWhy(program: Command): void {
    program
        .command('why <path>')
        .description(
            'Print which presets claim a file, the checks that run on it, and the baselines and ignores that touch it',
        )
        .action(async (path: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(async () => {
                const session = await openSession(findRoot(String(global['directory'] ?? process.cwd())));
                const report = why(session, path.replace(/^\.\//, '').replace(/\/$/, ''));
                if ('error' in report) return { text: `${report.error}\n`, json: report, exitCode: 2 };
                return { text: renderWhy(report), json: report, exitCode: 0 };
            }, global);
        });
}
