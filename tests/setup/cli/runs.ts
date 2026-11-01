import { planChecks } from '#cli/engine/plan.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { type RunOptions } from '#cli/types/commands/check.ts';
import { listOutdatedFiles } from '#cli/generation/outdated.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { type PlannedCheck } from '#cli/types/engine/planning.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { type Session, type CheckGeneration } from '#cli/types/session.ts';

/**
Options for an in-process run of every stage, with no fixes.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: `AGENTS.md` names it as the options of runChecks.
export function buildRunOptions(overrides: Partial<RunOptions>): RunOptions {
    return {
        stage: 'all',
        fix: false,
        cwd: process.cwd(),
        pathArguments: [],
        selectCheckCode,
        generation: CHECK_GENERATION,
        ...overrides,
    };
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The fixes tests write the gspot.toml text of a fixer through it, and jscpd reports the inlined copies as clones.
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

/**
The production generators, called only when a check needs their output.
*/
export const CHECK_GENERATION: CheckGeneration = {
    buildConfigs,
    listOutdatedFiles: (session, options) => listOutdatedFiles(session, buildGeneratedFiles(session), options),
};
