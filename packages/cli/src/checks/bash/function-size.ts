import { buildFinding } from '#cli/runs/finding.ts';
import { listCodeLines } from '#cli/parsers/bash.ts';
import type { Session } from '#cli/types/session.ts';
import { getLimit } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/bash/scripts.ts';
import { COUNT_LIMITS } from '#cli/config/checks/bash.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';

/**
 * Checks each shell function against the size limits: code lines and parser counts.
 *
 * @param session the repository and its tools.
 * @param planned the scope scripts and limits.
 * @returns one finding per exceeded limit.
 */
export async function checkBashFunctionSize(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const counts = {
                function_lines: listCodeLines(file.code.slice(entry.start - 1, entry.end)).length,
                function_branches: entry.branches,
                block_nesting: entry.nesting,
                function_assignments: entry.assignments,
            };
            return COUNT_LIMITS.flatMap(({ limit, rule, noun }) => {
                const maximum = getLimit(planned.selection.view, limit, 'bash');
                const count = counts[limit];
                return count <= maximum
                    ? []
                    : [
                          buildFinding(
                              planned,
                              { file: file.path, line: entry.start },
                              rule,
                              `${entry.name} has ${String(count)} ${noun}, over the limit of ${String(maximum)}.`,
                          ),
                      ];
            });
        }),
    );
}
