import { sep, join, posix } from 'node:path';
import { CheckStop } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import type { Level } from '#cli/types/settings.ts';
import { buildUvRunCommand } from '#cli/tools/uv.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { getTable, getLimit } from '#cli/settings/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { countCodeLines } from '#cli/parsers/code/comments.ts';
import { splitWords, escapeRegExp } from '#cli/system/text.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { REQUIREMENTS_FILE } from '#cli/config/repository/files.ts';
import { assertToolFindings } from '#cli/engine/tool-runs/output.ts';
import type { CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import { PATH_SEPARATOR_PATTERN } from '#cli/config/configurations/blocks.ts';
import { PYTHON_PACKAGE_FILE } from '#cli/config/configurations/structure.ts';
import { runCommandCheck, runCommandBatches } from '#cli/engine/tool-runs/check.ts';
import { deptrySchema, docstringStyleSchema } from '#cli/schemas/configurations.ts';
import { GSPOT_FOLDER, PYPROJECT_TOML, PYTHON_EXTENSION } from '#cli/config/parsers.ts';
import { findDocstring, readPythonFiles, parsePythonModule } from '#cli/parsers/code/python.ts';
import { joinScope, isInScope, listNestedScopes, isOutsideChildScopes } from '#cli/repository/scopes.ts';

import {
    type DeptryProject,
    type PydoclintOptions,
    type PythonDocstringStyle,
} from '#cli/types/configurations/language.ts';
import {
    PIP_INSTALL,
    PYTHON_RULES,
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
    PYDOCLINT_STYLE_FLAG,
    PYTHON_SOURCE_FOLDER,
    INSTALL_FILE_SUFFIXES,
    PYDOCLINT_TYPE_OPTIONS,
    PYTHON_NAME_SEPARATORS,
    CLASS_DOCSTRING_OPENING,
    DEPTRY_FIRST_PARTY_FLAG,
    PYDOCLINT_DEFAULT_STYLE,
    REQUIREMENTS_FOLDER_FILE,
    REQUIREMENTS_FILE_MESSAGE,
    PYDOCLINT_ALL_LEVEL_OPTIONS,
} from '#cli/config/configurations/python.ts';

function listFirstParty(session: Session, planned: PlannedCheck, project: DeptryProject): string[] {
    const sources = joinScope(planned.scope.path, PYTHON_SOURCE_FOLDER);
    const packages = session.repository.files
        .map(({ path }) => path)
        .filter((path) => posix.basename(path) === PYTHON_PACKAGE_FILE)
        .map((path) => posix.dirname(path))
        .filter((folder) => posix.dirname(folder) === sources)
        .map((folder) => posix.basename(folder));
    const projectName = project.project.name?.toLowerCase().replaceAll(PYTHON_NAME_SEPARATORS, '_');
    return [
        ...new Set([
            ...(projectName === undefined ? [] : [projectName]),
            ...packages,
            ...project.tool.deptry.known_first_party,
            ...getTable(planned.scope.settings, 'python').externals,
        ]),
    ].flatMap((module) => [DEPTRY_FIRST_PARTY_FLAG, module]);
}

async function listLongFunctions(
    session: Session,
    files: PlannedCheck['files'],
    path: string,
    limit: number,
): Promise<CheckFinding[]> {
    const { functions } = await readPythonFiles({ cache: session.cache, resources: session.resources, files });
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
                const count = await countCodeLines(lines.join('\n'), 'python', session);
                return count <= limit
                    ? []
                    : [
                          {
                              file: path,
                              line: node.startPosition.row + 1,
                              rule: PYTHON_RULES.functionLines,
                              message: `${name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                          },
                      ];
            }),
    );
    return findings.flat();
}

async function detectDocstringStyle(session: Session, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(path, readText(session.cache, path), session);
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

function parseVultureFinding(line: string, selected: ReadonlySet<string>): CheckFinding[] {
    const groups = VULTURE_FINDING.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = (groups['file'] ?? '').replaceAll(sep, '/');
    if (!selected.has(file)) return [];
    const at = { file, line: Number(groups['line']) };
    const { kind, name, statement } = groups;
    if (kind === undefined || name === undefined)
        return [
            {
                ...at,
                rule: PYTHON_RULES.unreachableCode,
                message: `The code after ${String(statement)} never runs. Delete it.`,
            },
        ];
    const message = `No code uses the ${kind} ${name}. Delete it, or, when code that vulture cannot see uses it by name, record that with gspot ignore python/vulture --paths ${file} and a reason.`;
    return [{ ...at, rule: `unused-${kind}`, message: message }];
}

/**
Runs deptry on the scope. Passes the project's extend_exclude list again with .gspot and child scopes added, because the command-line flag replaces it.

@param session the repository and installed tools.
@param planned the configured check and selected scope files.
*/
export async function checkDeptry(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const text = findText(session.cache, pyproject);
    if (text === undefined) throw new CheckStop('skipped', NO_PYPROJECT_NOTE);
    const project = parseTomlFile(pyproject, text, deptrySchema);
    return await runCommandCheck(session, planned, {
        command: buildUvRunCommand(planned.scope, join(session.root, planned.scope.path), [
            ...DEPTRY_COMMAND,
            ...[
                String.raw`(^|.*[/\\])${escapeRegExp(GSPOT_FOLDER)}([/\\]|$)`,
                ...listNestedScopes(
                    session.scopes.map((scope) => scope.path),
                    planned.scope.path,
                ).map((path) => {
                    const child = posix
                        .relative(planned.scope.path, path)
                        .split('/')
                        .map((segment) => escapeRegExp(segment))
                        .join(PATH_SEPARATOR_PATTERN);
                    return String.raw`^${child}([/\\]|$)`;
                }),
                ...project.tool.deptry.extend_exclude,
            ].flatMap((pattern) => [DEPTRY_EXCLUDE_FLAG, pattern]),
            ...listFirstParty(session, planned, project),
        ]),
    });
}

/**
Checks each Python function against limits.max_function_lines, counting code lines only.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@returns one finding per function over the limit.
*/
export async function checkPythonFunctionSize(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const limit = getLimit(planned.scope.settings, 'max_function_lines', 'python');
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
export function checkPipInstalls(session: Session, planned: PlannedCheck): CheckFinding[] {
    if (
        !(planned.check.files?.filenames ?? []).some((file) =>
            planned.files.some(({ path }) => path === joinScope(planned.scope.path, file)),
        )
    )
        throw new CheckStop('skipped', NO_LOCKFILE_NOTE);
    const files = planned.files.filter((file) => file.kind === 'source');
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path) || REQUIREMENTS_FOLDER_FILE.test(file.path))
        .map((file) => ({
            file: file.path,
            line: 1,
            rule: PYTHON_RULES.requirementsFile,
            message: REQUIREMENTS_FILE_MESSAGE,
        }));
    const installs = files
        .filter((file) => INSTALL_FILE_SUFFIXES.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            readText(session.cache, file.path)
                .split('\n')
                .flatMap((text, index): CheckFinding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              {
                                  file: file.path,
                                  line: index + 1,
                                  rule: PYTHON_RULES.pipInstall,
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
export async function checkPlaceholderDocstrings(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { functions, modules } = await readPythonFiles({
        cache: session.cache,
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
        const isClassOpening = definition.node.type === 'class_definition' && CLASS_DOCSTRING_OPENING.test(lowered);
        if (lowered !== '' && !isName && !isClassOpening && !PLACEHOLDERS.has(lowered)) return [];
        return [
            {
                file: definition.path,
                line: definition.node.startPosition.row + 1,
                column: definition.node.startPosition.column + 1,
                rule: PYTHON_RULES.placeholderDocstring,
                message: `The docstring of ${definition.name} says nothing the name does not. Describe its purpose or behavior.`,
            },
        ];
    });
}

/**
Runs pydoclint with the declared docstring style, or with the style each file uses.

@param session the repository and installed tools.
@param planned the configured check and selected scope files.
@returns the result, with earlier findings kept when a later batch fails.
*/
export async function checkPydoclint(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const configured = parsePydoclintOptions(
        pyproject,
        findText(session.cache, pyproject) ?? '',
        planned.scope.settings.tables.python?.docstring_convention,
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

/**
Runs vulture over every Python file of the scope, so that a use in any file counts, and reports the findings in the
files of this run.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@returns each unused definition and each line of unreachable code.
*/
export async function checkVulture(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scope = planned.scope.path;
    const children = listNestedScopes(
        session.scopes.map(({ path }) => path),
        scope,
    );
    const sources = session.repository.files
        .filter((file) => file.kind === 'source' && file.path.endsWith(PYTHON_EXTENSION))
        .filter((file) => isInScope(file.path, scope) && isOutsideChildScopes(file.path, children))
        .map((file) => file.path);
    if (sources.length === 0) return [];
    const result = await runCheckTool(session, planned, [...VULTURE_COMMAND, ...sources], { cwd: session.root });
    const selected = new Set(planned.files.map((file) => file.path));
    const findings = result.stdout.split('\n').flatMap((line) => parseVultureFinding(line, selected));
    return result.code === VULTURE_DEAD_CODE ? findings : assertToolFindings(result, findings, 'vulture');
}
