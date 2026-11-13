import { PYTHON_RULES } from '#cli/config/configurations/python.ts';
import { countCodeLines } from '#cli/parsers/code/comments.ts';
import { findDocstring, readPythonFiles } from '#cli/parsers/code/python.ts';
import { getLimit } from '#cli/settings/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

async function checkPythonFunctionSize(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const limit = getLimit(planned.scope.settings, 'max_function_lines', 'python');
    const { functions } = await readPythonFiles({
        cache: session.cache,
        resources: session.resources,
        files: planned.files,
    });
    const findings = await Promise.all(
        functions.map(async ({ node, name, path }) => {
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

export const PYTHON_FUNCTION_SIZE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/function-size': { check: checkPythonFunctionSize },
};
