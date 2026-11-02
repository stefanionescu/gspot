import { INSTALL_HELP } from '#cli/config/tools/programs.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { CheckSession, CheckRunOptions } from '#cli/types/engine/run.ts';
import { TOOL_LOCKFILES, GENERATED_FILE_FINDINGS } from '#cli/config/configurations/structure.ts';

/**
Reports each generated file on disk that does not match what the settings generate.

@param session the settings and repository.
@param _planned the configured check and selected scope files.
@param options whether to include the differences.
*/
export function checkGeneratedFiles(
    session: CheckSession,
    _planned: PlannedCheck,
    options: CheckRunOptions = {},
): CheckFinding[] {
    const stale = session.generation.listStaleFiles(session, options);
    return stale.map((staleFile) => {
        const { diff } = staleFile;
        return {
            file: staleFile.path,
            rule: staleFile.kind,
            message: GENERATED_FILE_FINDINGS[staleFile.kind].message,
            help: TOOL_LOCKFILES.has(staleFile.path) ? INSTALL_HELP : GENERATED_FILE_FINDINGS[staleFile.kind].help,
            ...(diff === undefined ? {} : { diff }),
        };
    });
}
