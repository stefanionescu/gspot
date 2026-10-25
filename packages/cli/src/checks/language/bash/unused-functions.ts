import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { MAIN_FUNCTION } from '#cli/config/checks/language/bash/scripts.ts';

/**
Reports each function that no script calls, except main.

@param session the repository and its tools.
@param planned the scope scripts to read.
@returns the findings.
*/
export async function checkBashUnusedFunctions(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scripts = await readScripts(session, planned);
    const referenced = new Set(scripts.flatMap((file) => file.calls.map(({ name }) => name)));
    return scripts.flatMap((file) => {
        return file.functions
            .filter((scriptFunction) => scriptFunction.name !== MAIN_FUNCTION && !referenced.has(scriptFunction.name))
            .map((scriptFunction) =>
                buildFinding(
                    planned,
                    { file: file.path, line: scriptFunction.start },
                    'never-called',
                    `No script in this scope calls ${scriptFunction.name}. Delete it, or call it.`,
                ),
            );
    });
}
