import { CONFIG_GUARD } from '#config/shell.ts';
// Every configuration owner opens with one include guard that no other owner shares. Searched: shellcheck; no such rule.
import type { Finding } from '#types/finding.ts';
import { codeLines } from '#cli/structure/code-lines.ts';
import type { Analysis, CodeLine, ShellFile, StructureContext } from '#types/structure.ts';

function guardName(first: CodeLine | undefined): string | undefined {
    return first === undefined ? undefined : CONFIG_GUARD.exec(first.code)?.groups?.['name'];
}

function markProblems(
    file: ShellFile,
    lines: [CodeLine, CodeLine | undefined],
    name: string,
    seen: Map<string, string>,
    context: StructureContext,
): Finding[] {
    const [first, second] = lines;
    const findings: Finding[] = [];
    const expected = `readonly ${name}=1`;
    if (second?.code !== expected)
        findings.push(
            context.report(file.path, first.number, 'guard-mark', `The line after the guard is ${expected}.`),
        );
    const other = seen.get(name);
    if (other !== undefined)
        findings.push(context.report(file.path, first.number, 'guard-shared', `${name} already guards ${other}.`));
    seen.set(name, file.path);
    return findings;
}

function guardFindings(file: ShellFile, seen: Map<string, string>, context: StructureContext): Finding[] {
    const [first, second] = codeLines(file.lines).filter((line) => !line.code.startsWith('#!'));
    const name = guardName(first);
    if (first === undefined || name === undefined)
        return [
            context.report(
                file.path,
                first?.number ?? 1,
                'guard-first',
                'A configuration owner opens with [[ -n ${_CFG_<NAME>_READY:-} ]] && return 0.',
            ),
        ];
    return markProblems(file, [first, second], name, seen, context);
}

/**
 * One finding per owner without the guard, with a malformed second line, or with a guard another owner already uses.
 * @param context the check context
 * @param shell the shell index
 * @returns the findings
 */
export const shellConfigGuards: Analysis = async (context, shell) => {
    const owners = new Set(context.bashList('config_owners'));
    const index = await shell();
    const seen = new Map<string, string>();
    return index.files.filter((file) => owners.has(file.path)).flatMap((file) => guardFindings(file, seen, context));
};
