import { convertToGlobs } from '#cli/configurations/ignores.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { printProgress } from '#cli/engine/report.ts';
import { runChecks } from '#cli/engine/run.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildIgnoreSections } from '#cli/generation/ignores.ts';
import { listStaleFiles } from '#cli/generation/stale.ts';
import { rewriteProgress } from '#cli/system/terminal.ts';
import type { CheckGeneration, RunResult } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

export const CHECK_GENERATION: CheckGeneration = {
    buildConfigs,
    listStaleFiles: (session, flags) => listStaleFiles(session, buildGeneratedFiles(session), flags),
    listWrittenPaths: (session) =>
        convertToGlobs(buildIgnoreSections(session, buildConfigs(session)).filter(({ key }) => key === 'gspot')),
};

/**
Run the commit and push checks on every file, with no fixes.

@param session the repository and its tools.
@param only the checks to run, when not every check.
@param skip the checks to leave out.
*/
export async function runEveryCheck(session: Session, only?: string[], skip?: string[]): Promise<RunResult> {
    try {
        return await runChecks(session, {
            selectCheckCode,
            generation: CHECK_GENERATION,
            only,
            skip,
            stage: 'all',
            fix: false,
            cwd: session.root,
            pathArguments: [],
            onProgress: printProgress,
        });
    } finally {
        rewriteProgress('');
    }
}
