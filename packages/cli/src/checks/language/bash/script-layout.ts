import { listCodeLines } from '#cli/parsers/bash.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { ENVIRONMENT_READERS_ROLE } from '#cli/config/settings/values.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import type { ScriptFile, ScriptReport } from '#cli/types/checks/language.ts';
import { readScripts, findEnclosingFunction } from '#cli/checks/language/bash/scripts.ts';

import {
    EXIT_CALL,
    MAIN_CALL,
    SET_COMMAND,
    STRICT_MODE,
    BASH_SHEBANGS,
    MAIN_FUNCTION,
    OTHER_SHEBANG,
    READONLY_WORD,
    SOURCE_STATEMENT,
    DECLARATION_WORDS,
    BASH_OPTION_COMMANDS,
    TOP_LEVEL_ASSIGNMENT,
} from '#cli/config/checks/language/bash.ts';

function checkStrictMode(code: NumberedLine[], report: ScriptReport): void {
    const first = code.findIndex((line) => !BASH_OPTION_COMMANDS.some((command) => line.text.startsWith(command)));
    const before = new Set(code.slice(0, first === -1 ? code.length : first).map((line) => line.text));
    if (!before.has(STRICT_MODE))
        report(code[0]?.number ?? 1, 'strict-mode', `Put ${STRICT_MODE} before the first command.`);
}

function checkMainFunction(file: ScriptFile, code: NumberedLine[], report: ScriptReport): void {
    if (file.functions.length === 0) return;
    if (file.functions.filter((entry) => entry.name === MAIN_FUNCTION).length !== 1)
        report(1, 'main-function', 'An executable defines exactly one main function.');
    const last = code.at(-1);
    if (last?.text !== MAIN_CALL) report(last?.number ?? 1, 'main-call', `An executable ends with ${MAIN_CALL}.`);
}

function isDeclarativeLine(text: string): boolean {
    return (
        SOURCE_STATEMENT.test(text) ||
        text.startsWith(READONLY_WORD) ||
        TOP_LEVEL_ASSIGNMENT.test(stripDeclaration(text))
    );
}

function checkLibraryLine(
    line: NumberedLine,
    file: ScriptFile,
    { isEnvironmentReader, report }: { isEnvironmentReader: boolean; report: ScriptReport },
): void {
    if (line.text.startsWith(SET_COMMAND)) {
        report(line.number, 'library-options', 'A sourced library does not change shell options.');
        return;
    }
    if (line.text === MAIN_CALL) {
        report(line.number, 'library-main', 'A sourced library does not call main.');
        return;
    }
    if (findEnclosingFunction(file.functions, line.number) !== undefined) return;
    if (EXIT_CALL.test(line.text)) {
        report(line.number, 'library-exit', 'A sourced library does not exit.');
        return;
    }
    if (isEnvironmentReader || isDeclarativeLine(line.text)) return;
    report(
        line.number,
        'library-flow',
        'A sourced library is declarative at the top level; this line runs when it is loaded.',
    );
}

function checkLibraryScript(
    file: ScriptFile,
    code: NumberedLine[],
    { isEnvironmentReader, report }: { isEnvironmentReader: boolean; report: ScriptReport },
): void {
    const last = code.at(-1);
    if (last?.text === MAIN_CALL) {
        report(
            last.number,
            'executable-bit',
            'This script ends with main "$@" but has no executable bit; run git update-index --chmod=+x on it.',
        );
        return;
    }
    if (file.functions.some((entry) => entry.name === MAIN_FUNCTION))
        report(1, 'library-main', 'A sourced library defines no main.');
    for (const line of code) checkLibraryLine(line, file, { isEnvironmentReader, report });
}

function checkScriptFile(
    input: CheckInput,
    file: ScriptFile,
    { isEnvironmentReader }: { isEnvironmentReader: boolean },
): Finding[] {
    const findings: Finding[] = [];
    const report: ScriptReport = (line, rule, text) => {
        findings.push(buildFinding(input, { file: file.path, line }, rule, text));
    };
    if (!BASH_SHEBANGS.has(file.lines[0] ?? ''))
        report(1, 'shebang', `The first line is not one of ${[...BASH_SHEBANGS].join(' or ')}.`);
    const code = listCodeLines(file.code);
    if (file.isExecutable) {
        checkStrictMode(code, report);
        checkMainFunction(file, code, report);
    } else checkLibraryScript(file, code, { isEnvironmentReader, report });
    for (const temporary of file.temporaryPaths)
        if (temporary.cleanupLines.length === 0)
            report(temporary.line, 'mktemp-trap', `The temporary path ${temporary.name} needs a trap that removes it.`);
    return findings;
}

/**
 * Removes a leading declaration word and its flags, and keeps the assignment or command.
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
 * @param input the scope scripts and environment readers.
 * @returns the findings.
 */
export async function checkBashScriptLayout(input: CheckInput): Promise<Finding[]> {
    const isEnvironmentReader = buildPathMatcher(input.selection.view.roles[ENVIRONMENT_READERS_ROLE]);
    const scripts = await readScripts(input);
    return scripts
        .filter((file) => !OTHER_SHEBANG.test(file.lines[0] ?? ''))
        .flatMap((file) => checkScriptFile(input, file, { isEnvironmentReader: isEnvironmentReader(file.path) }));
}
