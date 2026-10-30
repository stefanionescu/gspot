import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readScripts, listFunctionCalls } from '#cli/checks/language/bash/scripts.ts';
import { BATS_HOOKS, MAIN_FUNCTION, NEVER_CALLED_RULE } from '#cli/config/checks/language/bash.ts';

/**
Report functions with no callers. Exclude main and the bats hooks.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
export async function checkUnusedFunctions(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    const bats = new Set(planned.files.filter((file) => file.tags.includes('bats')).map((file) => file.path));
    return scripts.flatMap((file) => {
        return file.functions
            .filter(
                (scriptFunction) =>
                    scriptFunction.name !== MAIN_FUNCTION &&
                    !(bats.has(file.path) && BATS_HOOKS.has(scriptFunction.name)) &&
                    listFunctionCalls(scripts, file, scriptFunction.name).length === 0,
            )
            .map((scriptFunction) => ({
                file: file.path,
                line: scriptFunction.start,
                rule: NEVER_CALLED_RULE,
                message: `No script in this scope calls ${scriptFunction.name}. Delete it, or call it.`,
            }));
    });
}
