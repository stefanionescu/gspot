import { sep } from 'node:path';
import { listOwnFiles } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { assertToolFindings } from '#cli/engine/run/tool-runs/failures.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import { VULTURE_EXPLANATIONS } from '#cli/configurations/language/python/explanations.ts';

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
    return [{ ...at, rule: `unused-${kind}`, message }];
}

/**
Runs vulture over every Python file of the scope, so that a use in any file counts, and reports the findings in the
files of this run.
*/
async function checkVulture(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const sources = listOwnFiles(session.repository.files, session.scopes, planned.scope.path)
        .filter((file) => file.kind === 'source' && file.path.endsWith(PYTHON_EXTENSION))
        .map((file) => file.path);
    if (sources.length === 0) return [];
    const result = await runCheckTool(session, planned, [...VULTURE_COMMAND, ...sources], { cwd: session.root });
    const selected = new Set(planned.files.map((file) => file.path));
    const findings = result.stdout.split('\n').flatMap((line) => parseVultureFinding(line, selected));
    return result.code === VULTURE_DEAD_CODE ? findings : assertToolFindings(result, findings, 'vulture');
}

export const PYTHON_VULTURE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/vulture': { check: checkVulture, explanations: VULTURE_EXPLANATIONS },
};
