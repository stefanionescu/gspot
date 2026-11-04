import { INSTALL_HELP } from '#cli/config/tools/programs.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { GENERATED_FILE_RULE_DOCS } from '#cli/config/configurations/rule-docs/gspot.ts';
import { TOOL_LOCKFILES, GENERATED_FILE_FINDINGS } from '#cli/config/configurations/structure.ts';
import { type CheckCode, type CheckSession, type CheckRunOptions } from '#cli/types/engine/run.ts';

/**
Reports each generated file on disk that does not match what the settings generate.

@param session the settings and repository.
@param _planned the configured check and selected scope files.
@param options whether to include the differences.
*/
function checkGeneratedFiles(
    session: CheckSession,
    _planned: PlannedCheck,
    options: Pick<CheckRunOptions, 'verbose'> = {},
): CheckFinding[] {
    const stale = session.generation.listStaleFiles(session, options);
    return stale.map((staleFile) => {
        const { diff } = staleFile;
        return {
            file: staleFile.path,
            rule: staleFile.kind,
            message: GENERATED_FILE_FINDINGS[staleFile.kind].message,
            help: TOOL_LOCKFILES.has(staleFile.path) ? INSTALL_HELP : GENERATED_FILE_FINDINGS[staleFile.kind].help,
            ...(diff !== undefined && { diff }),
        };
    });
}

export const GSPOT_GENERATED_FILES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/generated-files': { check: checkGeneratedFiles, ruleDocs: GENERATED_FILE_RULE_DOCS },
};
