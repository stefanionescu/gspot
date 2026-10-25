import { planChecks } from '#cli/planning/checks.ts';
import type { Session } from '#cli/types/session.ts';
import type { RunOptions } from '#cli/types/runs/run.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

/**
Options for an in-process run of every stage, with no fixes.

@param overrides what the test changes.
@returns the defaults with the overrides applied.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 115 calls in 43 files share it.
export function buildRunOptions(overrides: Partial<RunOptions>): RunOptions {
    return { stage: 'all', fix: false, isDryRun: false, cwd: process.cwd(), pathArguments: [], ...overrides };
}

/**
The planned fixer of the sandbox, with a script in place of its fix command.

@param session the open sandbox.
@param fix the fixer command.
@returns the planned check.
*/
export function planFixer(session: Session, fix: readonly string[]): PlannedCheck {
    const [planned] = planChecks(session, { stage: 'all', only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [...fix] } };
}

/**
Build fixer settings whose check passes and whose fix exits 3, both through the fake tool program.

@param paths files the fixer covers.
@returns the gspot.toml text.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 14 calls in 2 files share it.
export function buildFixerSettings(paths: string[] = ['source.txt']): string {
    return `configurations = []
[[command_check]]
id = "sandbox/fixer"
command = ${JSON.stringify(buildProgramCommand('fakes/tool'))}
fix = ${JSON.stringify(buildProgramCommand('fakes/tool', '--exit', '3'))}
paths = ${JSON.stringify(paths)}
stage = "commit"
`;
}
