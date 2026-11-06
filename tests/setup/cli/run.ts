import { convertToGlobs } from '#cli/configurations/ignores.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildIgnoreSections } from '#cli/generation/ignores.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckGeneration, CheckRunOptions, RunOptions } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

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

export function planFixer(session: Session, fix: readonly string[]): PlannedCheck {
    const [planned] = planChecks(session, { stage: 'all', only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [...fix] } };
}

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

export const CHECK_RUN_OPTIONS: CheckRunOptions = {};

export const CHECK_GENERATION: CheckGeneration = {
    buildConfigs,
    listStaleFiles: (session, options) => listStaleFiles(session, buildGeneratedFiles(session), options),
    listWrittenPaths: (session) =>
        convertToGlobs(buildIgnoreSections(session, buildConfigs(session)).filter(({ key }) => key === 'gspot')),
};

export function createRunResources(): Disposable[] & Disposable {
    const resources: Disposable[] = [];
    return Object.assign(resources, {
        [Symbol.dispose]: () => {
            for (const resource of resources.splice(0).toReversed()) resource[Symbol.dispose]();
        },
    });
}
