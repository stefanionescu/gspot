import { planChecks } from '#cli/engine/plan.ts';
import type { Session } from '#cli/types/tools.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { convertToGlobs } from '#cli/configurations/ignores.ts';
import { buildIgnoreSections } from '#cli/generation/ignores.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import type { RunOptions, CheckRunOptions, CheckGeneration } from '#cli/types/engine/run.ts';

/**
Options for an in-process run of every stage, with no fixes.
*/
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
The options of one check that a test runs outside the engine, with an empty baseline that no test changes.
*/
export const CHECK_RUN_OPTIONS: CheckRunOptions = {
    baselineRun: { unused: new Map(), finished: [], paths: undefined },
};

/**
The production generators, called only when a check needs their output.
*/
export const CHECK_GENERATION: CheckGeneration = {
    buildConfigs,
    listStaleFiles: (session, options) => listStaleFiles(session, buildGeneratedFiles(session), options),
    listWrittenPaths: (session) =>
        convertToGlobs(buildIgnoreSections(session, buildConfigs(session)).filter(({ key }) => key === 'gspot')),
};

/**
Keep the resources of a run, and free them when the test disposes the list.
*/
export function createRunResources(): Disposable[] & Disposable {
    const resources: Disposable[] = [];
    return Object.assign(resources, {
        [Symbol.dispose]: () => {
            for (const resource of resources.splice(0).toReversed()) resource[Symbol.dispose]();
        },
    });
}
