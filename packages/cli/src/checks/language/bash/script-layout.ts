import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { listCodeLines } from '#cli/parsers/code/bash.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import type { ScriptFunction } from '#cli/types/parsers/code/bash.ts';
import type { ScriptFile, LayoutIssue } from '#cli/types/checks/language/bash.ts';

import {
    EXIT_CALL,
    MAIN_CALL,
    SET_COMMAND,
    STRICT_MODE,
    MAIN_FUNCTION,
    OTHER_SHEBANG,
    BASH_SHEBANGS,
    READONLY_WORD,
    SOURCE_STATEMENT,
    DECLARATION_WORDS,
    TOP_LEVEL_ASSIGNMENT,
    BASH_OPTION_COMMANDS,
} from '#cli/config/checks/language/bash/script-layout.ts';

function checkStrictMode(code: NumberedLine[]): LayoutIssue[] {
    const first = code.findIndex((line) => !BASH_OPTION_COMMANDS.some((command) => line.text.startsWith(command)));
    const before = new Set(code.slice(0, first === -1 ? code.length : first).map((line) => line.text));
    return before.has(STRICT_MODE)
        ? []
        : [{ line: code[0]?.number ?? 1, rule: 'strict-mode', text: `Put ${STRICT_MODE} before the first command.` }];
}

function checkMainFunction(file: ScriptFile, code: NumberedLine[]): LayoutIssue[] {
    if (file.functions.length === 0) return [];
    const issues: LayoutIssue[] = [];
    if (file.functions.filter((entry) => entry.name === MAIN_FUNCTION).length !== 1)
        issues.push({ line: 1, rule: 'main-function', text: 'An executable defines exactly one main function.' });
    const last = code.at(-1);
    if (last?.text !== MAIN_CALL)
        issues.push({ line: last?.number ?? 1, rule: 'main-call', text: `An executable ends with ${MAIN_CALL}.` });
    return issues;
}

/**
 * Finds the innermost function that holds a line.
 *
 * @param functions the parsed definitions.
 * @param line the number, counted from one.
 * @returns the function, or undefined at the top level.
 */
function findFunctionAtLine(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions
        .filter((entry) => entry.start <= line && line <= entry.end)
        .toSorted((left, right) => left.end - left.start - (right.end - right.start))[0];
}

function checkLibraryLine(
    line: NumberedLine,
    file: ScriptFile,
    { isEnvironmentReader }: { isEnvironmentReader: boolean },
): LayoutIssue[] {
    if (line.text.startsWith(SET_COMMAND))
        return [
            { line: line.number, rule: 'library-options', text: 'A sourced library does not change shell options.' },
        ];
    if (line.text === MAIN_CALL)
        return [{ line: line.number, rule: 'library-main', text: 'A sourced library does not call main.' }];
    if (findFunctionAtLine(file.functions, line.number) !== undefined) return [];
    return checkTopLevelLine(line, { isEnvironmentReader });
}

// A top-level line of a sourced library may only declare: source a file, mark a value readonly, or assign a value.
function checkTopLevelLine(
    line: NumberedLine,
    { isEnvironmentReader }: { isEnvironmentReader: boolean },
): LayoutIssue[] {
    if (EXIT_CALL.test(line.text))
        return [{ line: line.number, rule: 'library-exit', text: 'A sourced library does not exit.' }];
    if (
        isEnvironmentReader ||
        SOURCE_STATEMENT.test(line.text) ||
        line.text.startsWith(READONLY_WORD) ||
        TOP_LEVEL_ASSIGNMENT.test(stripDeclaration(line.text))
    )
        return [];
    return [
        {
            line: line.number,
            rule: 'library-flow',
            text: 'A sourced library is declarative at the top level; this line runs when it is loaded.',
        },
    ];
}

function checkLibraryScript(
    file: ScriptFile,
    code: NumberedLine[],
    { isEnvironmentReader }: { isEnvironmentReader: boolean },
): LayoutIssue[] {
    const last = code.at(-1);
    if (last?.text === MAIN_CALL)
        return [
            {
                line: last.number,
                rule: 'executable-bit',
                text: 'This script ends with main "$@" but has no executable bit; run git update-index --chmod=+x on it.',
            },
        ];
    const issues: LayoutIssue[] = [];
    if (file.functions.some((entry) => entry.name === MAIN_FUNCTION))
        issues.push({ line: 1, rule: 'library-main', text: 'A sourced library defines no main.' });
    return [...issues, ...code.flatMap((line) => checkLibraryLine(line, file, { isEnvironmentReader }))];
}

function checkScriptFile(
    planned: PlannedCheck,
    file: ScriptFile,
    { isEnvironmentReader }: { isEnvironmentReader: boolean },
): Finding[] {
    const issues: LayoutIssue[] = [];
    if (!BASH_SHEBANGS.has(file.lines[0] ?? ''))
        issues.push({
            line: 1,
            rule: 'shebang',
            text: `The first line is not one of ${[...BASH_SHEBANGS].join(' or ')}.`,
        });
    const code = listCodeLines(file.code);
    if (file.isExecutable) issues.push(...checkStrictMode(code), ...checkMainFunction(file, code));
    else issues.push(...checkLibraryScript(file, code, { isEnvironmentReader }));
    for (const temporary of file.temporaryPaths)
        if (temporary.cleanupLines.length === 0)
            issues.push({
                line: temporary.line,
                rule: 'mktemp-trap',
                text: `The temporary path ${temporary.name} needs a trap that removes it.`,
            });
    return issues.map(({ line, rule, text }) => buildFinding(planned, { file: file.path, line }, rule, text));
}

/**
 * Removes a leading declaration word and its flags, and keeps the assignment or command.
 *
 * @param code a line without comments.
 * @returns the value after export, readonly, local, declare, or typeset.
 */
function stripDeclaration(code: string): string {
    const words = code.split(/\s+/u);
    if (!DECLARATION_WORDS.has(words[0] ?? '')) return code;
    let index = 1;
    while ((words[index] ?? '').startsWith('-')) index += 1;
    return words.slice(index).join(' ');
}

/**
 * Checks the layout of each Bash script, and skips scripts with a shebang for another shell.
 *
 * @param session the repository and its tools.
 * @param planned the scope scripts and environment readers.
 * @returns the findings.
 */
export async function checkBashScriptLayout(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const isEnvironmentReader = buildPathMatcher(planned.scope.settings.values.structure?.environment_readers ?? []);
    const scripts = await readScripts(session, planned);
    return scripts
        .filter((file) => !OTHER_SHEBANG.test(file.lines[0] ?? ''))
        .flatMap((file) => checkScriptFile(planned, file, { isEnvironmentReader: isEnvironmentReader(file.path) }));
}
