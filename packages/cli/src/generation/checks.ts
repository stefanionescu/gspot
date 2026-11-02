import { runChecks } from '#cli/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';
import { printProgress } from '#cli/engine/report.ts';
import { PROGRESS_CLEAR } from '#cli/config/engine.ts';
import { writeProgress } from '#cli/system/terminal.ts';
import { buildConfigs } from '#cli/generation/configs.ts';
import { listOutdatedFiles } from '#cli/generation/outdated.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import type { RunResult, CheckGeneration } from '#cli/types/engine/run.ts';

export const CHECK_GENERATION: CheckGeneration = {
    buildConfigs,
    listOutdatedFiles: (session, flags) => listOutdatedFiles(session, buildGeneratedFiles(session), flags),
};

/**
Run the commit and push checks on every file, with no fixes.

@param session the repository and its tools.
@returns the report and the plan of the run.
*/
export async function runEveryCheck(session: Session): Promise<RunResult> {
    try {
        return await runChecks(session, {
            selectCheckCode,
            generation: CHECK_GENERATION,
            stage: 'all',
            fix: false,
            cwd: session.root,
            pathArguments: [],
            onProgress: printProgress,
        });
    } finally {
        if (process.stderr.isTTY) writeProgress(PROGRESS_CLEAR);
    }
}
