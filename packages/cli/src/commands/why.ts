// gspot why
import type { Command } from 'commander';
import { emit } from '#cli/commands/emit.ts';
import type { Result } from '#types/commands.ts';
import { openSession } from '#cli/run/session.ts';
import { whyText, why } from '#cli/output/why.ts';
import { directoryOf } from '#cli/commands/flags.ts';
import { findRoot } from '#cli/repository/tracked.ts';

function trimmedPath(path: string): string {
    const withoutDot = path.startsWith('./') ? path.slice('./'.length) : path;
    return withoutDot.endsWith('/') ? withoutDot.slice(0, -1) : withoutDot;
}

async function whyResult(directory: string, path: string): Promise<Result> {
    const session = await openSession(findRoot(directory));
    const report = why(session, trimmedPath(path));
    if ('error' in report) return { text: `${report.error}\n`, json: report, exitCode: 2 };
    return { text: whyText(report), json: report, exitCode: 0 };
}

/**
 * Registers why.
 * @param program the commander program
 */
export function registerWhy(program: Command): void {
    program
        .command('why <path>')
        .description(
            'Print which presets claim a file, the checks that run on it, and the baselines and ignores that touch it',
        )
        .action(async (path: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await emit(() => whyResult(directoryOf(global), path), global);
        });
}
