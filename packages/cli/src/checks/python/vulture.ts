import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { listChildScopes } from '#cli/planning/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { VULTURE_COMMAND, VULTURE_FINDING, VULTURE_DEAD_CODE } from '#cli/config/checks/python.ts';

function parseVultureFinding(planned: PlannedCheck, line: string, selected: ReadonlySet<string>): Finding[] {
    const groups = VULTURE_FINDING.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = groups['file'] ?? '';
    if (!selected.has(file)) return [];
    const at = { file, line: Number(groups['line']) };
    const { kind, name, statement } = groups;
    if (kind === undefined || name === undefined)
        return [
            buildFinding(planned, at, 'unreachable-code', `The code after ${String(statement)} never runs. Delete it.`),
        ];
    const message = `No code uses the ${kind} ${name}. Delete it, or, when code that vulture cannot see uses it by name, record that with gspot ignore python/vulture --names ${name} and a reason.`;
    return [{ ...buildFinding(planned, at, `unused-${kind}`, message), name }];
}

/**
 * Runs vulture over every Python file of the scope, so that a use in any file counts, and reports the findings in the
 * files of this run.
 *
 * @param session the repository and its tools.
 * @param planned the scope, its files, and the repository files.
 * @returns each unused definition and each line of unreachable code.
 */
export async function checkPythonVulture(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scope = planned.scope.folder.path;
    const children = listChildScopes(session.scopes, planned.scope);
    const sources = session.repository.files
        .filter((file) => file.kind === 'source' && file.path.endsWith('.py'))
        .filter((file) => isInScope(file.path, scope) && children.every((child) => !isInScope(file.path, child)))
        .map((file) => file.path);
    if (sources.length === 0) return [];
    const result = await runCheckTool(session, planned, [...VULTURE_COMMAND, ...sources], { cwd: session.root });
    const selected = new Set(planned.files.map((file) => file.path));
    const findings = result.stdout.split('\n').flatMap((line) => parseVultureFinding(planned, line, selected));
    return result.code === VULTURE_DEAD_CODE ? findings : assertToolFindings(result, findings, 'vulture');
}
