import { GENERATED_FILE_FINDINGS, TOOL_LOCKFILES } from '#cli/config/configurations/gspot.ts';
import { INSTALL_HELP } from '#cli/config/tools/programs.ts';
import { GENERATED_FILE_EXPLANATIONS } from '#cli/configurations/general/gspot/explanations.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckRunOptions, CheckSession } from '#cli/types/engine/run.ts';

function checkGeneratedFiles(
    session: CheckSession,
    _planned: PlannedCheck,
    options: Pick<CheckRunOptions, 'verbose'>,
): CheckFinding[] {
    const stale = session.generation.listStaleFiles(session, options);
    return stale.map((staleFile) => {
        const { diff } = staleFile;
        return {
            file: staleFile.path,
            rule: staleFile.kind,
            message: GENERATED_FILE_FINDINGS[staleFile.kind].message,
            help: TOOL_LOCKFILES.has(staleFile.path) ? INSTALL_HELP : GENERATED_FILE_FINDINGS[staleFile.kind].help,
            // Only gspot install writes a tool lockfile, because locking the tools needs the network.
            fixable: staleFile.kind === 'stray' || !TOOL_LOCKFILES.has(staleFile.path),
            ...(diff !== undefined && { diff }),
        };
    });
}

export const GSPOT_GENERATED_FILES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/generated-files': {
        check: checkGeneratedFiles,
        fix: (session) => session.generation.writeStaleFiles(session),
        explanations: GENERATED_FILE_EXPLANATIONS,
    },
};
