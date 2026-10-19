// Find Python definitions that no code uses, and code that never runs, across every Python file of the scope.
import { buildFinding } from '#cli/runs/finding.ts';
import { listChildScopes } from '#cli/planning/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { isInScope, isOutsideChildren } from '#cli/repository/scopes.ts';
import { VULTURE_COMMAND, VULTURE_FINDING, VULTURE_DEAD_CODE } from '#cli/config/checks/python.ts';

// Each unused definition, with the name that an [[ignore]] with names matches, or each line of unreachable code.
function readVultureFinding(input: CheckInput, line: string, selected: ReadonlySet<string>): Finding[] {
    const groups = VULTURE_FINDING.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = groups['file'] ?? '';
    if (!selected.has(file)) return [];
    const at = { file, line: Number(groups['line']) };
    const { kind, name, statement } = groups;
    if (kind === undefined || name === undefined)
        return [
            buildFinding(input, at, 'unreachable-code', `The code after ${String(statement)} never runs. Delete it.`),
        ];
    const message = `No code uses the ${kind} ${name}. Delete it, or, when code that vulture cannot see uses it by name, record that with gspot ignore python/vulture --names ${name} and a reason.`;
    return [{ ...buildFinding(input, at, `unused-${kind}`, message), name }];
}

/**
 * Runs vulture over every Python file of the scope, so that a use in any file counts, and reports the findings in the
 * files of this run.
 * @param input the scope, its files, and the repository files.
 * @returns each unused definition and each line of unreachable code.
 */
export async function checkVulture(input: CheckInput): Promise<Finding[]> {
    const scope = input.selection.scope.path;
    const children = listChildScopes({ scopes: input.selections }, input.selection);
    const sources = input.repositoryFiles
        .filter((file) => file.kind === 'source' && file.path.endsWith('.py'))
        .filter((file) => isInScope(file.path, scope) && isOutsideChildren(file.path, children))
        .map((file) => file.path);
    if (sources.length === 0) return [];
    const result = await runCheckTool(input, [...VULTURE_COMMAND, ...sources], { cwd: input.root });
    const selected = new Set(input.files.map((file) => file.path));
    const findings = result.stdout.split('\n').flatMap((line) => readVultureFinding(input, line, selected));
    return result.code === VULTURE_DEAD_CODE ? findings : assertToolFindings(result, findings, 'vulture');
}
