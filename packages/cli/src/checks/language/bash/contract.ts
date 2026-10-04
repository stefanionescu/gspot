// The interpreter contract of a Bash script: the header, strict mode, the entry point, the library shape, the directory constants, mktemp cleanup.
import semver from 'semver';
import { findingAt } from '#cli/execution/finding.ts';
import type { CodeLine } from '#cli/types/parsers/bash.ts';
import { codeLines, withoutDeclaration } from '#cli/parsers/bash.ts';
import { functionAt, getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import type { ScriptFile, ScriptReport } from '#cli/types/checks/language/bash.ts';
import type { Engine, Finding, EngineInput } from '#cli/types/execution/runtime.ts';

import {
    EXIT_CALL,
    MAIN_CALL,
    REMOVE_CALL,
    STRICT_MODE,
    RUNTIME_LINE,
    BASH_FEATURES,
    BASH_SHEBANGS,
    OTHER_SHEBANG,
    READONLY_WORD,
    HEADER_COMMENT,
    RUNTIME_HEADER,
    DIRECTORY_START,
    SOURCE_STATEMENT,
    BARE_COMMENT_LINE,
    INHERITED_ERREXIT,
    TOP_LEVEL_ASSIGNMENT,
    DIRECTORY_CONSTANT_SIGNS,
    DIRECTORY_CONSTANT_PIECES,
} from '#cli/config/checks/language/bash.ts';

// The shebang every script opens with, then the four-line header when bash.platforms names its platforms.
function headerProblems(file: ScriptFile, platforms: string | undefined, report: ScriptReport): void {
    if (!BASH_SHEBANGS.includes(file.lines[0] ?? ''))
        report(1, 'shebang', `The first line is not one of ${BASH_SHEBANGS.join(' or ')}.`);
    if (platforms === undefined) return;
    if (file.lines.length < RUNTIME_LINE || !HEADER_COMMENT.test(file.lines.slice(1, RUNTIME_LINE - 1).join('\n')))
        report(BARE_COMMENT_LINE, 'header', 'Lines 2 and 3 are a bare "#" and then "# <what this script does>".');
}

function runtimeVersion(file: ScriptFile, platforms: string, report: ScriptReport): string | undefined {
    const runtime = RUNTIME_HEADER.exec(file.lines[RUNTIME_LINE - 1] ?? '');
    const named = runtime?.groups?.['platforms'] ?? '';
    if (runtime === null || (named !== 'Linux' && named !== platforms)) {
        report(RUNTIME_LINE, 'runtime-header', `Line 4 is "# Runtime: Bash N.N+, ${platforms}." (or "Linux").`);
        return undefined;
    }
    const version = runtime.groups as Record<'major' | 'minor', string>;
    return `${version.major}.${version.minor}.0`;
}

function versionProblems(file: ScriptFile, version: string | undefined, report: ScriptReport): void {
    if (version === undefined) return;
    for (const [index, code] of file.code.entries()) {
        const feature = BASH_FEATURES.find(([pattern, , minimum]) => semver.lt(version, minimum) && pattern.test(code));
        if (feature !== undefined)
            report(index + 1, 'bash-version', `${feature[1]}, but the header declares Bash ${version}.`);
    }
}

// Three contract rules recognize a script-directory assignment through the same declaration syntax.
function isDirectoryConstant(code: string): boolean {
    return (
        DIRECTORY_START.test(withoutDeclaration(code)) && DIRECTORY_CONSTANT_SIGNS.every((sign) => code.includes(sign))
    );
}

function directoryProblems(code: CodeLine[], report: ScriptReport): void {
    for (const line of code) {
        if (!isDirectoryConstant(line.code)) continue;
        const missing = DIRECTORY_CONSTANT_PIECES.filter((piece) => !line.code.includes(piece));
        if (missing.length > 0)
            report(line.number, 'directory-constant', `A computed directory needs ${missing.join(', ')}.`);
    }
}

function isFrozenLater(code: CodeLine[], after: number, name: string): boolean {
    return code.some((line) => {
        if (line.number <= after) return false;
        const words = line.code.split(/\s+/u);
        return (
            words[0] === READONLY_WORD && words.slice(1).some((word) => word === name || word.startsWith(`${name}=`))
        );
    });
}

function unfrozenName(file: ScriptFile, line: CodeLine): string | undefined {
    if (functionAt(file.functions, line.number) !== undefined || line.code.startsWith(READONLY_WORD)) return undefined;
    const name = TOP_LEVEL_ASSIGNMENT.exec(withoutDeclaration(line.code))?.groups?.['name'];
    return name === undefined || isDirectoryConstant(line.code) ? undefined : name;
}

function readonlyProblems(file: ScriptFile, code: CodeLine[], report: ScriptReport): void {
    for (const line of code) {
        const name = unfrozenName(file, line);
        if (name !== undefined && !isFrozenLater(code, line.number, name))
            report(line.number, 'top-level-assignment', `${name} is assigned at the top level without readonly.`);
    }
}

function strictModeProblems(code: CodeLine[], version: string | undefined, report: ScriptReport): void {
    const first = code.findIndex((line) => !line.code.startsWith('set ') && !line.code.startsWith('shopt '));
    const before = new Set(code.slice(0, first === -1 ? code.length : first).map((line) => line.code));
    const required = [...STRICT_MODE];
    if (version !== undefined && semver.gte(version, INHERITED_ERREXIT.version))
        required.push(INHERITED_ERREXIT.statement);
    const missing = required.filter((statement) => !before.has(statement));
    if (missing.length > 0)
        report(code[0]?.number ?? 1, 'strict-mode', `Put ${missing.join(' and ')} before the first command.`);
}

function entryProblems(file: ScriptFile, code: CodeLine[], report: ScriptReport): void {
    if (file.functions.filter((entry) => entry.name === 'main').length !== 1)
        report(1, 'main-function', 'An executable defines exactly one main function.');
    const last = code.at(-1);
    if (last?.code !== MAIN_CALL) report(last?.number ?? 1, 'main-call', `An executable ends with ${MAIN_CALL}.`);
}

function topLevelProblem(line: CodeLine, file: ScriptFile, isConfigOwner: boolean): [string, string] | undefined {
    if (functionAt(file.functions, line.number) !== undefined) return undefined;
    if (EXIT_CALL.test(line.code)) return ['library-exit', 'A sourced library does not exit.'];
    if (
        isConfigOwner ||
        SOURCE_STATEMENT.test(line.code) ||
        line.code.startsWith(READONLY_WORD) ||
        isDirectoryConstant(line.code)
    )
        return undefined;
    return ['library-flow', 'A sourced library is declarative at the top level; this line runs when it is loaded.'];
}

function libraryProblem(line: CodeLine, file: ScriptFile, isConfigOwner: boolean): [string, string] | undefined {
    if (line.code.startsWith('set ')) return ['library-options', 'A sourced library does not change shell options.'];
    if (line.code === MAIN_CALL) return ['library-main', 'A sourced library does not call main.'];
    return topLevelProblem(line, file, isConfigOwner);
}

function roleProblems(file: ScriptFile, code: CodeLine[], isConfigOwner: boolean, report: ScriptReport): void {
    if (file.isExecutable) {
        entryProblems(file, code, report);
        return;
    }
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
        const problem = libraryProblem(line, file, isConfigOwner);
        if (problem !== undefined) report(line.number, problem[0], problem[1]);
    }
}

function cleanupProblems(code: CodeLine[], report: ScriptReport): void {
    const temporary = code.find((line) => /\bmktemp\b/u.test(line.code));
    const isTrapped = code.some((line) => line.code.startsWith('trap ') && REMOVE_CALL.test(line.code));
    if (temporary !== undefined && !isTrapped)
        report(temporary.number, 'mktemp-trap', 'A temporary file needs a trap that removes it.');
}

function fileProblems(
    input: EngineInput,
    file: ScriptFile,
    platforms: string | undefined,
    isConfigOwner: boolean,
): Finding[] {
    const findings: Finding[] = [];
    const report: ScriptReport = (line, rule, text) => {
        findings.push(findingAt(input, { file: file.path, line }, rule, text));
    };
    headerProblems(file, platforms, report);
    // Without the header, a script declares no Bash version, so no feature is checked against one.
    const version = platforms === undefined ? undefined : runtimeVersion(file, platforms, report);
    versionProblems(file, version, report);
    const code = codeLines(file.code).filter((line) => !line.code.startsWith('#!'));
    directoryProblems(code, report);
    readonlyProblems(file, code, report);
    if (file.isExecutable) strictModeProblems(code, version, report);
    roleProblems(file, code, isConfigOwner, report);
    cleanupProblems(code, report);
    return findings;
}

/**
 * The findings of the interpreter contract over every Bash script; a script with another shell's shebang is left alone.
 * @param input the check context
 * @returns the findings
 */
export const contract: Engine = async (input) => {
    const runtime = input.view.settings['bash.platforms'];
    const platforms = typeof runtime === 'string' ? runtime : undefined;
    const owners = new Set(input.view.settings['bash.config_owners'] as string[]);
    const index = await getScriptIndex(input);
    return index.files
        .filter((file) => !OTHER_SHEBANG.test(file.lines[0] ?? ''))
        .flatMap((file) => fileProblems(input, file, platforms, owners.has(file.path)));
};
