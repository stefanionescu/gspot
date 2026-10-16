// The Bash interpreter contract: shebang, strict mode, entry point, library shape, and temporary cleanup.
import { findingAt } from '#cli/checks/finding.ts';
import { listCodeLines } from '#cli/parsers/bash.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import type { ScriptFile, ScriptReport } from '#cli/types/checks/language.ts';
import { functionAt, readScripts } from '#cli/checks/language/bash/scripts.ts';

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

function strictModeFindings(code: NumberedLine[], report: ScriptReport): void {
    const first = code.findIndex((line) => !BASH_OPTION_COMMANDS.some((command) => line.text.startsWith(command)));
    const before = new Set(code.slice(0, first === -1 ? code.length : first).map((line) => line.text));
    if (!before.has(STRICT_MODE))
        report(code[0]?.number ?? 1, 'strict-mode', `Put ${STRICT_MODE} before the first command.`);
}

function entryFindings(file: ScriptFile, code: NumberedLine[], report: ScriptReport): void {
    if (file.functions.length === 0) return;
    if (file.functions.filter((entry) => entry.name === MAIN_FUNCTION).length !== 1)
        report(1, 'main-function', 'An executable defines exactly one main function.');
    const last = code.at(-1);
    if (last?.text !== MAIN_CALL) report(last?.number ?? 1, 'main-call', `An executable ends with ${MAIN_CALL}.`);
}

function libraryLineFindings(line: NumberedLine, file: ScriptFile, isDeclarative: boolean, report: ScriptReport): void {
    if (line.text.startsWith(SET_COMMAND)) {
        report(line.number, 'library-options', 'A sourced library does not change shell options.');
        return;
    }
    if (line.text === MAIN_CALL) {
        report(line.number, 'library-main', 'A sourced library does not call main.');
        return;
    }
    if (functionAt(file.functions, line.number) !== undefined) return;
    if (EXIT_CALL.test(line.text)) {
        report(line.number, 'library-exit', 'A sourced library does not exit.');
        return;
    }
    if (isDeclarative) return;
    report(
        line.number,
        'library-flow',
        'A sourced library is declarative at the top level; this line runs when it is loaded.',
    );
}

function libraryFindings(file: ScriptFile, code: NumberedLine[], isConfigOwner: boolean, report: ScriptReport): void {
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
    for (const line of code) {
        const isDeclarative =
            isConfigOwner ||
            SOURCE_STATEMENT.test(line.text) ||
            line.text.startsWith(READONLY_WORD) ||
            TOP_LEVEL_ASSIGNMENT.test(withoutDeclaration(line.text));
        libraryLineFindings(line, file, isDeclarative, report);
    }
}

function fileFindings(input: CheckInput, file: ScriptFile, isConfigOwner: boolean): Finding[] {
    const findings: Finding[] = [];
    const report: ScriptReport = (line, rule, text) => {
        findings.push(findingAt(input, { file: file.path, line }, rule, text));
    };
    if (!BASH_SHEBANGS.has(file.lines[0] ?? ''))
        report(1, 'shebang', `The first line is not one of ${[...BASH_SHEBANGS].join(' or ')}.`);
    const code = listCodeLines(file.code);
    if (file.isExecutable) {
        strictModeFindings(code, report);
        entryFindings(file, code, report);
    } else libraryFindings(file, code, isConfigOwner, report);
    for (const temporary of file.temporaryPaths)
        if (temporary.cleanupLines.length === 0)
            report(temporary.line, 'mktemp-trap', `The temporary path ${temporary.name} needs a trap that removes it.`);
    return findings;
}

/**
 * Remove a declaration word and its flags. Retain the assignment or command.
 * @param code a comment-free code line.
 * @returns the value after export, readonly, local, declare, or typeset.
 */
function withoutDeclaration(code: string): string {
    const words = code.split(/\s+/u);
    if (!DECLARATION_WORDS.has(words[0] ?? '')) return code;
    let index = 1;
    while ((words[index] ?? '').startsWith('-')) index += 1;
    return words.slice(index).join(' ');
}

/**
 * The findings of the interpreter contract over every Bash script; leave scripts with another shell's shebang unchanged.
 * @param input the check context.
 * @returns the findings.
 */
export async function bashScriptLayout(input: CheckInput): Promise<Finding[]> {
    const isOwner = buildPathMatcher(input.selection.view.roles.environment_readers);
    const index = await readScripts(input);
    return index
        .filter((file) => !OTHER_SHEBANG.test(file.lines[0] ?? ''))
        .flatMap((file) => fileFindings(input, file, isOwner(file.path)));
}
