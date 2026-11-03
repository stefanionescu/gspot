import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';
import { BATS_HOOKS, MAIN_FUNCTION, NEVER_CALLED_RULE } from '#cli/config/configurations/bash.ts';

/**
Report functions that no script in the scope calls. A script can call a function that another script defines, because
a main script sources its helpers together, and bats loads them. Exclude main and the bats hooks.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
export async function checkUnusedFunctions(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    const called = new Set(scripts.flatMap((file) => file.calls.map((call) => call.name)));
    const bats = new Set(planned.files.filter((file) => file.tags.includes('bats')).map((file) => file.path));
    return scripts.flatMap((file) => {
        return file.functions
            .filter(
                (scriptFunction) =>
                    scriptFunction.name !== MAIN_FUNCTION &&
                    !(bats.has(file.path) && BATS_HOOKS.has(scriptFunction.name)) &&
                    !called.has(scriptFunction.name),
            )
            .map((scriptFunction) => ({
                file: file.path,
                line: scriptFunction.start,
                rule: NEVER_CALLED_RULE,
                message: `No script in this scope calls ${scriptFunction.name}. Delete it, or call it.`,
            }));
    });
}
