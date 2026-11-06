import { COUNT_LIMITS } from '#cli/config/configurations/bash.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';
import { FUNCTION_SIZE_EXPLANATIONS } from '#cli/configurations/language/bash/explanations.ts';
import { listCodeLines } from '#cli/parsers/code/bash.ts';
import { getLimit } from '#cli/settings/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

async function checkBashFunctionSize(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.functions.flatMap((scriptFunction) => {
            const counts = {
                max_function_lines: listCodeLines(file.code.slice(scriptFunction.start - 1, scriptFunction.end)).length,
                max_function_branches: scriptFunction.branches,
                max_block_nesting: scriptFunction.nesting,
                max_function_assignments: scriptFunction.assignments,
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

export const BASH_FUNCTION_SIZE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'bash/function-size': { check: checkBashFunctionSize, explanations: FUNCTION_SIZE_EXPLANATIONS },
};
