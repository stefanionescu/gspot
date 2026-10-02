import { findingAt } from '#cli/execution/finding.ts';
import type { Finding } from '#cli/types/execution/execution.ts';
import { codeLines } from '#cli/checks/language/bash/code-lines.ts';
import type { CodeLine, ScriptFile } from '#cli/types/checks/language/bash.ts';
import { CONFIG_GUARD, DEFAULT_EXPANSION } from '#cli/config/checks/language/bash.ts';
import type { StructureInput, StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';

function markProblems(
    file: ScriptFile,
    lines: [CodeLine, CodeLine | undefined],
    name: string,
    seen: Map<string, string>,
    context: StructureInput,
): Finding[] {
    const [first, second] = lines;
    const findings: Finding[] = [];
    const expected = `readonly ${name}=1`;
    if (second?.code !== expected)
        findings.push(
            findingAt(
                context.input,
                { file: file.path, line: first.number },
                'guard-mark',
                `The line after the guard is ${expected}.`,
            ),
        );
    const other = seen.get(name);
    if (other !== undefined)
        findings.push(
            findingAt(
                context.input,
                { file: file.path, line: first.number },
                'guard-shared',
                `${name} already guards ${other}.`,
            ),
        );
    seen.set(name, file.path);
    return findings;
}

function guardFindings(file: ScriptFile, seen: Map<string, string>, context: StructureInput): Finding[] {
    const [first, second] = codeLines(file.lines).filter((line) => !line.code.startsWith('#!'));
    const name = first === undefined ? undefined : CONFIG_GUARD.exec(first.code)?.groups?.['name'];
    if (first === undefined || name === undefined)
        return [
            findingAt(
                context.input,
                { file: file.path, line: first?.number ?? 1 },
                'guard-first',
                'A configuration owner opens with [[ -n ${<GUARD>:-} ]] && return 0.',
            ),
        ];
    return markProblems(file, [first, second], name, seen, context);
}

/**
 * One finding per `${name:-value}` default outside the configuration owners, unless an allowed fragment is on the line.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptConfigDefaults: Analysis = async (context, scripts) => {
    const owners = new Set(context.bashSetting('config_owners') as string[] | undefined);
    const fragments = context.bashList('defaults_allowed');
    const index = await scripts();
    return index.files.flatMap((file) => {
        if (owners.has(file.path)) return [];
        return file.lines.flatMap((line, position) => {
            if (line.trimStart().startsWith('#') || fragments.some((fragment) => line.includes(fragment))) return [];
            const match = DEFAULT_EXPANSION.exec(line);
            return match === null
                ? []
                : [
                      findingAt(
                          context.input,
                          { file: file.path, line: position + 1 },
                          'default-outside-owner',
                          `${match[0]} sets a default outside the configuration owners.`,
                      ),
                  ];
        });
    });
};

/**
 * One finding per owner without the guard, with a malformed second line, or with a guard another owner already uses.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const scriptGuards: Analysis = async (context, scripts) => {
    const owners = new Set(context.bashList('config_owners'));
    const index = await scripts();
    const seen = new Map<string, string>();
    return index.files.filter((file) => owners.has(file.path)).flatMap((file) => guardFindings(file, seen, context));
};
