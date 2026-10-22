// Builds run options, and a fixer check whose command each test sets.
import { planChecks } from '#cli/planning/checks.ts';
import type { Session } from '#cli/types/session.ts';
import type { RunOptions } from '#cli/types/runs/run.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';

/**
 * Options for an in-process run of every stage, with no fixes.
 *
 * @param overrides what the test changes.
 * @returns the defaults with the overrides applied.
 */
export function buildRunOptions(overrides: Partial<RunOptions>): RunOptions {
    return { stage: 'all', fix: false, isDryRun: false, ...overrides };
}

/**
 * The planned fixer of the sandbox, with a script in place of its fix command.
 *
 * @param session the open sandbox.
 * @param script JavaScript for the fixer to run.
 * @returns the planned check.
 */
export function planFixer(session: Session, script: string): PlannedCheck {
    const [planned] = planChecks(session, { stage: 'all', only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [process.execPath, '-e', script] } };
}

/**
 * Build fixer settings that run the executable of this test process.
 *
 * @param paths files the fixer covers.
 * @returns the gspot.toml text.
 */
export function buildFixerSettings(paths: string[] = ['source.txt']): string {
    return `configurations = []
[[command_check]]
id = "sandbox/fixer"
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
fix = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 3"]
paths = ${JSON.stringify(paths)}
stage = "commit"
`;
}
