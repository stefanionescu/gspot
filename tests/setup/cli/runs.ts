import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type RunOptions } from '#cli/types/commands/check.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

/**
Options for an in-process run of every stage, with no fixes.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: `AGENTS.md` names it as the options of runChecks.
export function buildRunOptions(overrides: Partial<RunOptions>): RunOptions {
    return { stage: 'all', fix: false, dryRun: false, cwd: process.cwd(), pathArguments: [], ...overrides };
}

/**
The planned fixer of the sandbox, with this command in place of its fix command.
*/
export function planFixer(session: Session, fix: readonly string[]): PlannedCheck {
    const [planned] = planChecks(session, { stage: 'all', only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [...fix] } };
}

/**
Build the gspot.toml text of a fixer whose check passes and whose fix fails, both through the fake tool program.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, its gspot.toml text makes duplication/jscpd clones in the fixes tests.
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
