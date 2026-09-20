// The interpreter contract of a Bash script: the header, strict mode, the entry point, the library shape, the directory constants, mktemp cleanup.
import semver from 'semver';
import type { Finding } from '#types/finding.ts';
import { functionAt } from '#cli/structure/parser.ts';
import type { Analysis, CodeLine, ShellFile, ShellReport, StructureContext } from '#types/structure.ts';
import { codeLines, isDirectoryConstant, withoutComment, withoutDeclaration } from '#cli/structure/code-lines.ts';

import {
    BASH_FEATURES,
    INHERITED_ERREXIT,
    BASH_SHEBANGS,
    DIRECTORY_CONSTANT_PIECES,
    HEADER_LINES,
    MAIN_CALL,
    OTHER_SHELL_SHEBANG,
    RUNTIME_HEADER,
    SOURCE_STATEMENT,
    STRICT_MODE,
    TOP_LEVEL_ASSIGNMENT,
} from '#config/shell.ts';

const EXIT_CALL = /\bexit(?:\s|$)/u;
const REMOVE_CALL = /\brm\b/u;
const READONLY_WORD = 'readonly';

function isDescriptionLine(line: string): boolean {
    return line.startsWith('# ') && line.slice('# '.length).trim() !== '';
}

function shebangProblem(file: ShellFile, report: ShellReport): void {
    if (!BASH_SHEBANGS.includes(file.lines[0] ?? ''))
        report(1, 'shebang', `The first line is not one of ${BASH_SHEBANGS.join(' or ')}.`);
}

function headerProblem(file: ShellFile, report: ShellReport): void {
    const [, second = '', third = ''] = file.lines;
    if (second !== '#' || file.lines.length < HEADER_LINES || !isDescriptionLine(third))
        report(2, 'header', 'Lines 2 and 3 are a bare "#" and then "# <what this script does>".');
}

function isPlatformNamed(runtime: RegExpExecArray | null, platforms: string): boolean {
    const named = runtime?.groups?.['platforms'] ?? '';
    return named === 'Linux' || named === platforms;
}

function runtimeVersion(file: ShellFile, platforms: string, report: ShellReport): string | undefined {
    const runtime = RUNTIME_HEADER.exec(file.lines[HEADER_LINES - 1] ?? '');
    if (runtime === null || !isPlatformNamed(runtime, platforms)) {
        report(HEADER_LINES, 'runtime-header', `Line 4 is "# Runtime: Bash N.N+, ${platforms}." (or "Linux").`);
        return undefined;
    }
    const version = runtime.groups as Record<'major' | 'minor', string>;
    return `${version.major}.${version.minor}.0`;
}

function versionProblems(file: ShellFile, version: string | undefined, report: ShellReport): void {
    if (version === undefined) return;
    for (const [index, line] of file.lines.entries()) {
        const code = withoutComment(line);
        const feature = BASH_FEATURES.find(([pattern, , minimum]) => semver.lt(version, minimum) && pattern.test(code));
        if (feature !== undefined)
            report(index + 1, 'bash-version', `${feature[1]}, but the header declares Bash ${version}.`);
    }
}

function directoryProblems(code: CodeLine[], report: ShellReport): void {
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

function unfrozenName(file: ShellFile, line: CodeLine): string | undefined {
    if (functionAt(file.functions, line.number) !== undefined || line.code.startsWith(READONLY_WORD)) return undefined;
    const name = TOP_LEVEL_ASSIGNMENT.exec(withoutDeclaration(line.code))?.groups?.['name'];
    return name === undefined || isDirectoryConstant(line.code) ? undefined : name;
}

function readonlyProblems(file: ShellFile, code: CodeLine[], report: ShellReport): void {
    for (const line of code) {
        const name = unfrozenName(file, line);
        if (name !== undefined && !isFrozenLater(code, line.number, name))
            report(line.number, 'top-level-assignment', `${name} is assigned at the top level without readonly.`);
    }
}

function strictModeProblems(code: CodeLine[], version: string | undefined, report: ShellReport): void {
    const first = code.findIndex((line) => !line.code.startsWith('set ') && !line.code.startsWith('shopt '));
    const before = new Set(code.slice(0, first === -1 ? code.length : first).map((line) => line.code));
    const required = [...STRICT_MODE];
    if (version !== undefined && semver.gte(version, INHERITED_ERREXIT.version))
        required.push(INHERITED_ERREXIT.statement);
    const missing = required.filter((statement) => !before.has(statement));
    if (missing.length > 0)
        report(code[0]?.number ?? 1, 'strict-mode', `${missing.join(' and ')} come before the first command.`);
}

function entryProblems(file: ShellFile, code: CodeLine[], report: ShellReport): void {
    if (file.functions.filter((entry) => entry.name === 'main').length !== 1)
        report(1, 'main-function', 'An executable defines exactly one main function.');
    const last = code.at(-1);
    if (last?.code !== MAIN_CALL) report(last?.number ?? 1, 'main-call', `An executable ends with ${MAIN_CALL}.`);
}

function isDeclarative(line: CodeLine, file: ShellFile): boolean {
    const { code } = line;
    return (
        SOURCE_STATEMENT.test(code) ||
        code.startsWith(READONLY_WORD) ||
        isDirectoryConstant(code) ||
        functionAt(file.functions, line.number) !== undefined
    );
}

function libraryLineProblem(line: CodeLine, file: ShellFile, isConfigOwner: boolean): [string, string] | undefined {
    if (line.code.startsWith('set ')) return ['library-options', 'A sourced library does not change shell options.'];
    if (line.code === MAIN_CALL) return ['library-main', 'A sourced library does not call main.'];
    const isTopLevel = functionAt(file.functions, line.number) === undefined;
    if (isTopLevel && EXIT_CALL.test(line.code)) return ['library-exit', 'A sourced library does not exit.'];
    if (isTopLevel && !isConfigOwner && !isDeclarative(line, file))
        return ['library-flow', 'A sourced library is declarative at the top level; this line runs when it is loaded.'];
    return undefined;
}

function libraryProblems(file: ShellFile, code: CodeLine[], isConfigOwner: boolean, report: ShellReport): void {
    if (file.functions.some((entry) => entry.name === 'main'))
        report(1, 'library-main', 'A sourced library defines no main.');
    for (const line of code) {
        const problem = libraryLineProblem(line, file, isConfigOwner);
        if (problem !== undefined) report(line.number, problem[0], problem[1]);
    }
}

function roleProblems(file: ShellFile, code: CodeLine[], isConfigOwner: boolean, report: ShellReport): void {
    const last = code.at(-1);
    if (file.isExecutable) {
        entryProblems(file, code, report);
    } else if (last?.code === MAIN_CALL)
        report(
            last.number,
            'executable-bit',
            'This script ends with main "$@" but has no executable bit; run git update-index --chmod=+x on it.',
        );
    else libraryProblems(file, code, isConfigOwner, report);
}

function cleanupProblems(code: CodeLine[], report: ShellReport): void {
    const temporary = code.find((line) => /\bmktemp\b/u.test(line.code));
    const isTrapped = code.some((line) => line.code.startsWith('trap ') && REMOVE_CALL.test(line.code));
    if (temporary !== undefined && !isTrapped)
        report(temporary.number, 'mktemp-trap', 'A temporary file needs a trap that removes it.');
}

function fileProblems(
    context: StructureContext,
    file: ShellFile,
    platforms: string,
    isConfigOwner: boolean,
): Finding[] {
    const findings: Finding[] = [];
    const report: ShellReport = (line, rule, text) => {
        findings.push(context.report(file.path, line, rule, text));
    };
    shebangProblem(file, report);
    headerProblem(file, report);
    const version = runtimeVersion(file, platforms, report);
    versionProblems(file, version, report);
    const code = codeLines(file.lines).filter((line) => !line.code.startsWith('#!'));
    directoryProblems(code, report);
    readonlyProblems(file, code, report);
    if (file.isExecutable) strictModeProblems(code, version, report);
    roleProblems(file, code, isConfigOwner, report);
    cleanupProblems(code, report);
    return findings;
}

/**
 * The findings of the interpreter contract over every Bash script; a script with another shell's shebang is left alone.
 * @param context the check context
 * @param shell the shell index
 * @returns the findings
 */
export const shellInterpreter: Analysis = async (context, shell) => {
    const platforms = context.bashText('runtime_header', 'macOS and Linux');
    const owners = new Set(context.bashList('config_owners'));
    const index = await shell();
    return index.files
        .filter((file) => !OTHER_SHELL_SHEBANG.test(file.lines[0] ?? ''))
        .flatMap((file) => fileProblems(context, file, platforms, owners.has(file.path)));
};
