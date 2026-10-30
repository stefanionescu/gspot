import { join, posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { buildUvRunCommand } from '#cli/tools/uv.ts';
import type { Level } from '#cli/types/manifests.ts';
import { find, read } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { getTable, getLimit } from '#cli/settings/scopes.ts';
import { REQUIREMENTS_FILE } from '#cli/config/files/names.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { splitWords } from '#cli/checks/general/naming/settings.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code/python.ts';
import { PATH_SEPARATOR_PATTERN } from '#cli/config/files/path-patterns.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { countCodeLines } from '#cli/checks/cross-configuration/code-lines.ts';
import { type CheckResult, type CheckFinding } from '#cli/types/runs/check.ts';
import { runCommandCheck, runCommandBatches } from '#cli/runs/command/check.ts';
import { joinScope, isInScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { RUFF_TABLE } from '#cli/config/generation/configurations/language/python.ts';
import { deptrySchema, docstringStyleSchema } from '#cli/schemas/checks/language/python.ts';
import { findDocstring, readPythonFiles, parsePythonModule } from '#cli/parsers/code/python.ts';
import { type PydoclintOptions, type PythonDocstringStyle } from '#cli/types/checks/language/python.ts';

import {
    RULES,
    PIP_INSTALL,
    PLACEHOLDERS,
    NON_WORD_RUN,
    DEPTRY_COMMAND,
    VULTURE_COMMAND,
    VULTURE_FINDING,
    NUMPY_DOCSTRING,
    NO_LOCKFILE_NOTE,
    GOOGLE_DOCSTRING,
    NO_PYPROJECT_NOTE,
    VULTURE_DEAD_CODE,
    PYDOCLINT_COMMAND,
    PIP_INSTALL_MESSAGE,
    DEPTRY_EXCLUDE_FLAG,
    DEPTRY_GSPOT_EXCLUDE,
    PYDOCLINT_STYLE_FLAG,
    INSTALL_FILE_SUFFIXES,
    PYDOCLINT_TYPE_OPTIONS,
    DEPTRY_FIRST_PARTY_FLAG,
    PYDOCLINT_DEFAULT_STYLE,
    REQUIREMENTS_FOLDER_FILE,
    REQUIREMENTS_FILE_MESSAGE,
    PYDOCLINT_ALL_LEVEL_OPTIONS,
} from '#cli/config/checks/language/python.ts';

function listFirstParty(planned: PlannedCheck, written: string[]): string[] {
    const externals = getTable(planned.scope.settings, 'python').externals;
    return externals.length === 0
        ? []
        : [...new Set([...written, ...externals])].flatMap((module) => [DEPTRY_FIRST_PARTY_FLAG, module]);
}

/**
Runs deptry on the scope. Passes the project's extend_exclude list again with .gspot and child scopes added, because the command-line flag replaces it.

@param session the repository and installed tools.
@param planned the configured check and selected scope files.
*/
export async function checkPythonDeptry(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const text = find(session.reads, pyproject);
    if (text === undefined) throw new GspotError('skip', NO_PYPROJECT_NOTE);
    const { extend_exclude: exclusions, known_first_party: firstParty } = parseTomlFile(pyproject, text, deptrySchema)
        .tool.deptry;
    return await runCommandCheck(session, planned, {
        command: buildUvRunCommand(planned.scope, join(session.root, planned.scope.path), [
            ...DEPTRY_COMMAND,
            ...[
                DEPTRY_GSPOT_EXCLUDE,
                ...listNestedScopes(
                    session.scopes.map((scope) => scope.path),
                    planned.scope.path,
                ).map((path) => {
                    const child = posix
                        .relative(planned.scope.path, path)
                        .split('/')
                        .map((segment) => RegExp.escape(segment))
                        .join(PATH_SEPARATOR_PATTERN);
                    return String.raw`^${child}([/\\]|$)`;
                }),
                ...exclusions,
            ].flatMap((pattern) => [DEPTRY_EXCLUDE_FLAG, pattern]),
            ...listFirstParty(planned, firstParty),
        ]),
    });
}

async function listLongFunctions(
    session: Session,
    files: PlannedCheck['files'],
    path: string,
    limit: number,
): Promise<CheckFinding[]> {
    const { functions } = await readPythonFiles({ reads: session.reads, resources: session.resources, files });
    const findings = await Promise.all(
        functions
            .filter((definition) => definition.path === path)
            .map(async ({ node, name }) => {
                const lines = node.text.split('\n');
                const first = node.childForFieldName('body')?.namedChildren.find((child) => child.type !== 'comment');
                if (first !== undefined && findDocstring(node) !== undefined) {
                    for (let row = first.startPosition.row; row <= first.endPosition.row; row += 1)
                        lines[row - node.startPosition.row] = '';
                }
                const count = await countCodeLines(lines.join('\n'), 'python');
                return count <= limit
                    ? []
                    : [
                          {
                              file: path,
                              line: node.startPosition.row + 1,
                              rule: RULES.functionLines,
                              message: `${name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                          },
                      ];
            }),
    );
    return findings.flat();
}

/**
Checks each Python function against limits.function_lines, counting code lines only.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@returns one finding per function over the limit.
*/
export async function checkPythonFunctionSize(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const limit = getLimit(planned.scope.settings, 'function_lines', 'python');
    const files = planned.files.filter((file) => file.path.endsWith(PYTHON_EXTENSION));
    const findings = await Promise.all(
        files.map((file) => listLongFunctions(session, planned.files, file.path, limit)),
    );
    return findings.flat();
}

/**
Reports hand-kept requirements files and unmanaged pip installs, so pyproject.toml owns every dependency.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export function checkPythonPipInstalls(session: Session, planned: PlannedCheck): CheckFinding[] {
    if (
        !(planned.check.files?.filenames ?? []).some((file) =>
            planned.files.some(({ path }) => path === joinScope(planned.scope.path, file)),
        )
    )
        throw new GspotError('skip', NO_LOCKFILE_NOTE);
    const files = planned.files.filter((file) => file.kind === 'source');
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path) || REQUIREMENTS_FOLDER_FILE.test(file.path))
        .map((file) => ({
            file: file.path,
            line: 1,
            rule: RULES.requirementsFile,
            message: REQUIREMENTS_FILE_MESSAGE,
        }));
    const installs = files
        .filter((file) => INSTALL_FILE_SUFFIXES.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            read(session.reads, file.path)
                .split('\n')
                .flatMap((text, index): CheckFinding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              {
                                  file: file.path,
                                  line: index + 1,
                                  rule: RULES.pipInstall,
                                  message: PIP_INSTALL_MESSAGE,
                              },
                          ]
                        : [],
                ),
        );
    return [...requirements, ...installs];
}

/**
Reports Python docstrings that only repeat a name or placeholder.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkPythonPlaceholderDocstrings(
    session: Session,
    planned: PlannedCheck,
): Promise<CheckFinding[]> {
    const { functions, modules } = await readPythonFiles({
        reads: session.reads,
        resources: session.resources,
        files: planned.files,
    });
    const definitions = [
        ...functions,
        ...modules.flatMap(({ path, tree }) =>
            tree.rootNode
                .descendantsOfType('class_definition')
                .map((node) => ({ path, node, name: node.childForFieldName('name')?.text ?? '' })),
        ),
    ];
    return definitions.flatMap((definition) => {
        const text = findDocstring(definition.node);
        if (text === undefined) return [];
        const lowered = text.toLowerCase().replaceAll(NON_WORD_RUN, ' ').trim();
        const isName = lowered === splitWords(definition.name).join(' ');
        if (lowered !== '' && !isName && !PLACEHOLDERS.has(lowered)) return [];
        return [
            {
                file: definition.path,
                line: definition.node.startPosition.row + 1,
                column: definition.node.startPosition.column + 1,
                rule: RULES.placeholderDocstring,
                message: `The docstring of ${definition.name} says nothing the name does not. Describe its purpose or behavior.`,
            },
        ];
    });
}

async function detectDocstringStyle(session: Session, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(path, read(session.reads, path), session);
    using tree = module.tree;
    for (const node of tree.rootNode.descendantsOfType(['function_definition', 'class_definition'])) {
        const docstring = findDocstring(node);
        if (docstring === undefined) continue;
        if (GOOGLE_DOCSTRING.test(docstring)) return 'google';
        if (NUMPY_DOCSTRING.test(docstring)) return 'numpy';
    }
    return undefined;
}

async function groupByDocstringStyle(
    session: Session,
    files: TrackedFile[],
    configured: PythonDocstringStyle | undefined,
) {
    const styled: { file: TrackedFile; style: PythonDocstringStyle | undefined }[] = [];
    for (const file of files) {
        const style = configured ?? (await detectDocstringStyle(session, file.path));
        styled.push({ file, style });
    }
    return new Map(
        Map.groupBy(styled, ({ style }) => style)
            .entries()
            .map(([style, group]) => [style, group.map(({ file }) => file)]),
    );
}

function parsePydoclintOptions(path: string, text: string, convention: unknown, level: Level): PydoclintOptions {
    const { tool } = parseTomlFile(path, text, docstringStyleSchema);
    const inherited = tool.ruff.lint.pydocstyle.convention ?? convention;
    const style = tool.pydoclint.style ?? (inherited === 'google' || inherited === 'numpy' ? inherited : undefined);
    const written = new Set(Object.keys(tool.pydoclint).map((name) => name.replaceAll('_', '-')));
    const options =
        level === 'all' ? [...PYDOCLINT_TYPE_OPTIONS, ...PYDOCLINT_ALL_LEVEL_OPTIONS] : PYDOCLINT_TYPE_OPTIONS;
    const defaults = options.flatMap((name) => (written.has(name) ? [] : [`--${name}`, 'false']));
    return { command: [...PYDOCLINT_COMMAND, ...defaults], style };
}

/**
Runs pydoclint with the declared docstring style, or with the style each file uses.

@param session the repository and installed tools.
@param planned the configured check and selected scope files.
@returns the result, with earlier findings kept when a later batch fails.
*/
export async function checkPythonPydoclint(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const configured = parsePydoclintOptions(
        pyproject,
        find(session.reads, pyproject) ?? '',
        planned.scope.settings.tables[RUFF_TABLE]?.docstring_convention,
        session.settings.level,
    );
    const groups = await groupByDocstringStyle(session, planned.files, configured.style);
    return runCommandBatches(
        session,
        planned,
        [...groups].map(([style, files]) => ({
            files,
            command: [...configured.command, PYDOCLINT_STYLE_FLAG, style ?? PYDOCLINT_DEFAULT_STYLE],
        })),
    );
}

function parseVultureFinding(line: string, selected: ReadonlySet<string>): CheckFinding[] {
    const groups = VULTURE_FINDING.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = groups['file'] ?? '';
    if (!selected.has(file)) return [];
    const at = { file, line: Number(groups['line']) };
    const { kind, name, statement } = groups;
    if (kind === undefined || name === undefined)
        return [
            {
                ...at,
                rule: RULES.unreachableCode,
                message: `The code after ${String(statement)} never runs. Delete it.`,
            },
        ];
    const message = `No code uses the ${kind} ${name}. Delete it, or, when code that vulture cannot see uses it by name, record that with gspot ignore python/vulture --paths ${file} and a reason.`;
    return [{ ...at, rule: `unused-${kind}`, message: message }];
}

/**
Runs vulture over every Python file of the scope, so that a use in any file counts, and reports the findings in the
files of this run.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@returns each unused definition and each line of unreachable code.
*/
export async function checkPythonVulture(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scope = planned.scope.path;
    const children = listNestedScopes(
        session.scopes.map(({ path }) => path),
        scope,
    );
    const sources = session.repository.files
        .filter((file) => file.kind === 'source' && file.path.endsWith(PYTHON_EXTENSION))
        .filter((file) => isInScope(file.path, scope) && children.every((child) => !isInScope(file.path, child)))
        .map((file) => file.path);
    if (sources.length === 0) return [];
    const result = await runCheckTool(session, planned, [...VULTURE_COMMAND, ...sources], { cwd: session.root });
    const selected = new Set(planned.files.map((file) => file.path));
    const findings = result.stdout.split('\n').flatMap((line) => parseVultureFinding(line, selected));
    return result.code === VULTURE_DEAD_CODE ? findings : assertToolFindings(result, findings, 'vulture');
}
