import { sep } from 'node:path';
import { isInScope } from '#cli/system/paths.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import { listNestedScopes, isOutsideChildScopes } from '#cli/repository/scopes.ts';
import { VULTURE_RULE_DOCS } from '#cli/config/configurations/rule-docs/language.ts';

import {
    PYTHON_RULES,
    VULTURE_COMMAND,
    VULTURE_FINDING,
    VULTURE_DEAD_CODE,
} from '#cli/config/configurations/python.ts';

function parseVultureFinding(line: string, selected: ReadonlySet<string>): CheckFinding[] {
    const groups = VULTURE_FINDING.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = (groups['file'] ?? '').replaceAll(sep, '/');
    if (!selected.has(file)) return [];
    const at = { file, line: Number(groups['line']) };
    const { kind, name, statement } = groups;
    if (kind === undefined || name === undefined)
        return [
            {
                ...at,
                rule: PYTHON_RULES.unreachableCode,
                message: `The code after ${String(statement)} never runs. Delete it.`,
            },
        ];
    const message = `No code uses the ${kind} ${name}. Delete it, or, when code that vulture cannot see uses it by name, record that with gspot ignore python/vulture --paths ${file} and a reason.`;
    return [{ ...at, rule: `unused-${kind}`, message: message }];
}

/**
Runs vulture over every Python file of the scope, so that a use in any file counts, and reports the findings in the
files of this run.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@returns each unused definition and each line of unreachable code.
*/
async function checkVulture(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scopePath = planned.scope.path;
    const scopePaths = session.scopes.map(({ path }) => path);
    const children = listNestedScopes(scopePaths, scopePath);
    const sources = session.repository.files
        .filter((file) => file.kind === 'source' && file.path.endsWith(PYTHON_EXTENSION))
        .filter((file) => isInScope(file.path, scopePath) && isOutsideChildScopes(file.path, children))
        .map((file) => file.path);
    if (sources.length === 0) return [];
    const result = await runCheckTool(session, planned, [...VULTURE_COMMAND, ...sources], { cwd: session.root });
    const selected = new Set(planned.files.map((file) => file.path));
    const findings = result.stdout.split('\n').flatMap((line) => parseVultureFinding(line, selected));
    return result.code === VULTURE_DEAD_CODE ? findings : assertToolFindings(result, findings, 'vulture');
}

export const PYTHON_VULTURE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/vulture': { check: checkVulture, ruleDocs: VULTURE_RULE_DOCS },
};
