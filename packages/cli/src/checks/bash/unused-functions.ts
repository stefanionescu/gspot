import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/bash/scripts.ts';
import { MAIN_FUNCTION } from '#cli/config/checks/bash.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';

/**
 * Reports each function that no script calls, except main.
 *
 * @param session the repository and its tools.
 * @param planned the scope scripts to read.
 * @returns the findings.
 */
export async function checkBashUnusedFunctions(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scripts = await readScripts(session, planned);
    const referenced = new Set(scripts.flatMap((file) => file.calls.map(({ name }) => name)));
    return scripts.flatMap((file) => {
        return file.functions
            .filter((entry) => entry.name !== MAIN_FUNCTION && !referenced.has(entry.name))
            .map((entry) =>
                buildFinding(
                    planned,
                    { file: file.path, line: entry.start },
                    'never-called',
                    `No script in this scope calls ${entry.name}. Delete it, or call it.`,
                ),
            );
    });
}
