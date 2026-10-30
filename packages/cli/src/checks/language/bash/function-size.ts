import { getLimit } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { listCodeLines } from '#cli/parsers/code/bash.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { COUNT_LIMITS } from '#cli/config/checks/language/bash.ts';

/**
Checks each shell function against the size limits: code lines, branches, nesting, and assignments.

@param session the repository and its tools.
@param planned the scope scripts and limits.
@returns one finding per exceeded limit.
*/
export async function checkBashFunctionSize(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.functions.flatMap((scriptFunction) => {
            const counts = {
                function_lines: listCodeLines(file.code.slice(scriptFunction.start - 1, scriptFunction.end)).length,
                function_branches: scriptFunction.branches,
                block_nesting: scriptFunction.nesting,
                function_assignments: scriptFunction.assignments,
            };
            return COUNT_LIMITS.flatMap(({ limit, rule, noun }) => {
                const maximum = getLimit(planned.scope.settings, limit, 'bash');
                const count = counts[limit];
                return count <= maximum
                    ? []
                    : [
                          {
                              file: file.path,
                              line: scriptFunction.start,
                              rule: rule,
                              message: `${scriptFunction.name} has ${String(count)} ${noun}, over the limit of ${String(maximum)}.`,
                          },
                      ];
            });
        }),
    );
}
