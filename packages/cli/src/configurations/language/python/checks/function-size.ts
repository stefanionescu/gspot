import { PYTHON_RULES } from '#cli/config/configurations/python.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code.ts';
import { countCodeLines } from '#cli/parsers/code/comments.ts';
import { findDocstring, readPythonFiles } from '#cli/parsers/code/python.ts';
import { getLimit } from '#cli/settings/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

async function listLongFunctions(
    session: Session,
    files: PlannedCheck['files'],
    path: string,
    limit: number,
): Promise<CheckFinding[]> {
    const { functions } = await readPythonFiles({ cache: session.cache, resources: session.resources, files });
    const findings = await Promise.all(
        functions
            .filter((definition) => definition.path === path)
            .map(async ({ node, name }) => {
                const lines = node.text.split('\n');
                const first = node.childForFieldName('body')?.namedChildren.find((child) => child.type !== 'comment');
                if (first !== undefined && findDocstring(node) !== undefined) {
                    for (let row = first.startPosition.row; row <= first.endPosition.row; row += 1)
                        lines[row - node.startPosition.row] = '';
                }
                const count = await countCodeLines(lines.join('\n'), 'python', session);
                return count <= limit
                    ? []
                    : [
                          {
                              file: path,
                              line: node.startPosition.row + 1,
                              rule: PYTHON_RULES.functionLines,
                              message: `${name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                          },
                      ];
            }),
    );
    return findings.flat();
}

async function checkPythonFunctionSize(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const limit = getLimit(planned.scope.settings, 'max_function_lines', 'python');
    const files = planned.files.filter((file) => file.path.endsWith(PYTHON_EXTENSION));
    const findings = await Promise.all(
        files.map((file) => listLongFunctions(session, planned.files, file.path, limit)),
    );
    return findings.flat();
}

export const PYTHON_FUNCTION_SIZE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/function-size': { check: checkPythonFunctionSize },
};
