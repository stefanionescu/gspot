// The Bash interpreter contract: shebang, strict mode, entry point, library shape, and temporary cleanup.
import { findingAt } from '#cli/checks/finding.ts';
import type { CodeLine } from '#cli/types/parsers/bash.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { rolePaths } from '#cli/policy/settings/contracts.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { codeLines, withoutDeclaration } from '#cli/parsers/bash/public.ts';
import type { CheckInput, BuiltInCheck } from '#cli/types/execution/check.ts';
import { functionAt, getScriptIndex } from '#cli/checks/language/contracts.ts';
import type { ScriptFile, ScriptReport } from '#cli/types/checks/language/bash.ts';

import {
    EXIT_CALL,
    MAIN_CALL,
    STRICT_MODE,
    BASH_SHEBANGS,
    OTHER_SHEBANG,
    READONLY_WORD,
    SOURCE_STATEMENT,
    TOP_LEVEL_ASSIGNMENT,
} from '#cli/config/checks/language/bash.ts';

function strictModeFindings(code: CodeLine[], report: ScriptReport): void {
    const first = code.findIndex((line) => !line.code.startsWith('set ') && !line.code.startsWith('shopt '));
    const before = new Set(code.slice(0, first === -1 ? code.length : first).map((line) => line.code));
    const missing = STRICT_MODE.filter((statement) => !before.has(statement));
    if (missing.length > 0)
        report(code[0]?.number ?? 1, 'strict-mode', `Put ${missing.join(' and ')} before the first command.`);
}

function entryFindings(file: ScriptFile, code: CodeLine[], report: ScriptReport): void {
    if (file.functions.length === 0) return;
    if (file.functions.filter((entry) => entry.name === 'main').length !== 1)
        report(1, 'main-function', 'An executable defines exactly one main function.');
    const last = code.at(-1);
    if (last?.code !== MAIN_CALL) report(last?.number ?? 1, 'main-call', `An executable ends with ${MAIN_CALL}.`);
}

function libraryLineFindings(line: CodeLine, file: ScriptFile, isDeclarative: boolean, report: ScriptReport): void {
    if (line.code.startsWith('set ')) {
        report(line.number, 'library-options', 'A sourced library does not change shell options.');
        return;
    }
    if (line.code === MAIN_CALL) {
        report(line.number, 'library-main', 'A sourced library does not call main.');
        return;
    }
    if (functionAt(file.functions, line.number) !== undefined) return;
    if (EXIT_CALL.test(line.code)) {
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

function libraryFindings(file: ScriptFile, code: CodeLine[], isConfigOwner: boolean, report: ScriptReport): void {
    const last = code.at(-1);
    if (last?.code === MAIN_CALL) {
        report(
            last.number,
            'executable-bit',
            'This script ends with main "$@" but has no executable bit; run git update-index --chmod=+x on it.',
        );
        return;
    }
    if (file.functions.some((entry) => entry.name === 'main'))
        report(1, 'library-main', 'A sourced library defines no main.');
    for (const line of code) {
        const isDeclarative =
            isConfigOwner ||
            SOURCE_STATEMENT.test(line.code) ||
            line.code.startsWith(READONLY_WORD) ||
            TOP_LEVEL_ASSIGNMENT.test(withoutDeclaration(line.code));
        libraryLineFindings(line, file, isDeclarative, report);
    }
}

function fileFindings(input: CheckInput, file: ScriptFile, isConfigOwner: boolean): Finding[] {
    const findings: Finding[] = [];
    const report: ScriptReport = (line, rule, text) => {
        findings.push(findingAt(input, { file: file.path, line }, rule, text));
    };
    if (!BASH_SHEBANGS.includes(file.lines[0] ?? ''))
        report(1, 'shebang', `The first line is not one of ${BASH_SHEBANGS.join(' or ')}.`);
    const code = codeLines(file.code).filter((line) => !line.code.startsWith('#!'));
    if (file.isExecutable) strictModeFindings(code, report);
    if (file.isExecutable) entryFindings(file, code, report);
    else libraryFindings(file, code, isConfigOwner, report);
    for (const temporary of file.temporaryPaths)
        if (temporary.cleanupLines.length === 0)
            report(temporary.line, 'mktemp-trap', `The temporary path ${temporary.name} needs a trap that removes it.`);
    return findings;
}

/**
 * The findings of the interpreter contract over every Bash script; a script with another shell's shebang is left alone.
 * @param input the check context
 * @returns the findings
 */
export const contract: BuiltInCheck = async (input) => {
    const isOwner = pathMatcher(rolePaths(input.policyFiles.policy.architecture.roles, 'env'));
    const index = await getScriptIndex(input);
    return index.files
        .filter((file) => !OTHER_SHEBANG.test(file.lines[0] ?? ''))
        .flatMap((file) => fileFindings(input, file, isOwner(file.path)));
};
