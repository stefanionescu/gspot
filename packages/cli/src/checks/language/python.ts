import { join, posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { listChildScopes } from '#cli/planning/files.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import { buildUvRunCommand } from '#cli/tools/python.ts';
import { countCodeLines } from '#cli/checks/code-lines.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { getTable, getLimit } from '#cli/settings/scopes.ts';
import { REQUIREMENTS_FILE } from '#cli/config/files/names.ts';
import { joinScope, isInScope } from '#cli/repository/scopes.ts';
import { assertToolFindings } from '#cli/runs/command/output.ts';
import { buildFinding, getNodePlace } from '#cli/runs/finding.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { type Finding, type CheckResult } from '#cli/types/runs/check.ts';
import { findCachedText, readCachedText } from '#cli/system/files/reads.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { runCheckCommand, runCommandGroups } from '#cli/runs/command/check.ts';
import { COMMENT_MARKERS } from '#cli/config/checks/general/structure/long-files.ts';
import { deptrySchema, docstringStyleSchema } from '#cli/schemas/checks/language/python.ts';
import { findDocstring, PYTHON_SOURCES, parsePythonModule } from '#cli/parsers/code/python.ts';
import { type PydoclintOptions, type PythonDocstringStyle } from '#cli/types/checks/language/python.ts';

import {
    PIP_INSTALL,
    PLACEHOLDERS,
    NON_WORD_RUN,
    DEPTRY_COMMAND,
    VULTURE_COMMAND,
    VULTURE_FINDING,
    NUMPY_DOCSTRING,
    GOOGLE_DOCSTRING,
    VULTURE_DEAD_CODE,
    PYDOCLINT_COMMAND,
    DEPTRY_EXCLUDE_FLAG,
    PYDOCLINT_STYLE_FLAG,
    INSTALL_FILE_SUFFIXES,
    PYDOCLINT_TYPE_OPTIONS,
    DEPTRY_FIRST_PARTY_FLAG,
    PYDOCLINT_DEFAULT_STYLE,
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
@param planned the dependency check and its scope.
@returns the check result.
*/
export async function checkPythonDeptry(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const text = findCachedText(session.reads, joinScope(planned.scope.folder.path, PYPROJECT_TOML));
    if (text === undefined) throw new GspotError('skip', 'This scope has no pyproject.toml for deptry to read.');
    const { extend_exclude: exclusions, known_first_party: firstParty } = parseTomlFile(
        joinScope(planned.scope.folder.path, PYPROJECT_TOML),
        text,
        deptrySchema,
    ).tool.deptry;
    return await runCheckCommand(session, planned, {
        command: buildUvRunCommand(planned.scope, join(session.root, planned.scope.folder.path), [
            ...DEPTRY_COMMAND,
            ...[
                String.raw`(^|.*[/\\])${RegExp.escape(DOT_GSPOT)}([/\\]|$)`,
                ...listChildScopes(session.scopes, planned.scope).map((path) => {
                    const child = posix
                        .relative(planned.scope.folder.path, path)
                        .split('/')
                        .map((segment) => RegExp.escape(segment))
                        .join(String.raw`[/\\]`);
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
    planned: PlannedCheck,
    path: string,
    limit: number,
): Promise<Finding[]> {
    const text = readCachedText(session.reads, path);
    const lines = text.split('\n');
    const tree = await parseSource('python', text);
    try {
        return tree.rootNode.descendantsOfType('function_definition').flatMap((node) => {
            const count = countCodeLines(
                lines.slice(node.startPosition.row, node.endPosition.row + 1),
                COMMENT_MARKERS.python,
            );
            if (count <= limit) return [];
            const name = node.childForFieldName('name')?.text ?? 'function';
            return [
                buildFinding(
                    planned,
                    { file: path, line: node.startPosition.row + 1 },
                    'function-lines',
                    `${name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                ),
            ];
        });
    } finally {
        tree.delete();
    }
}

/**
Checks each Python function against limits.function_lines, counting code lines only.

@param session the repository and its tools.
@param planned the scope files and limits.
@returns one finding per function over the limit.
*/
export async function checkPythonFunctionSize(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const limit = getLimit(planned.scope.settings, 'function_lines', 'python');
    const files = planned.files.filter((file) => file.path.endsWith('.py'));
    const findings = await Promise.all(files.map((file) => listLongFunctions(session, planned, file.path, limit)));
    return findings.flat();
}

/**
Reports hand-kept requirements files and unmanaged pip installs, so pyproject.toml owns every dependency.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkPythonPipInstalls(session: Session, planned: PlannedCheck): Finding[] {
    if (
        (planned.check.files?.filenames ?? []).every((file) =>
            planned.files.every(({ path }) => path !== joinScope(planned.scope.folder.path, file)),
        )
    )
        throw new GspotError('skip', 'This check needs uv.lock, poetry.lock, or pdm.lock in this scope.');
    const files = planned.files.filter((file) => file.kind === 'source');
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path))
        .map((file) =>
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'requirements-file',
                'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.',
            ),
        );
    const installs = files
        .filter((file) => INSTALL_FILE_SUFFIXES.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            readCachedText(session.reads, file.path)
                .split('\n')
                .flatMap((text, index): Finding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              buildFinding(
                                  planned,
                                  { file: file.path, line: index + 1 },
                                  'pip-install',
                                  'Add the package to pyproject.toml and install it from the lockfile.',
                              ),
                          ]
                        : [],
                ),
        );
    return [...requirements, ...installs];
}

/**
Reports Python docstrings that only repeat a name or placeholder.

@param session the repository and its tools.
@param planned the scope Python files.
@returns the findings.
*/
export async function checkPythonPlaceholderDocstrings(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const { functions } = await parseCached(
        { root: session.root, reads: session.reads, resources: session.resources, files: planned.files },
        PYTHON_SOURCES,
    );
    return functions.flatMap((definition) => {
        const text = findDocstring(definition.node);
        if (text === undefined) return [];
        const lowered = text.toLowerCase().replaceAll(NON_WORD_RUN, ' ').trim();
        const isName = lowered === definition.name.toLowerCase().replaceAll('_', ' ').trim();
        if (lowered !== '' && !isName && !PLACEHOLDERS.has(lowered)) return [];
        return [
            buildFinding(
                planned,
                getNodePlace(definition.path, definition.node),
                'placeholder-docstring',
                `The docstring of ${definition.name} says nothing the name does not. Say what the function does, or for whom.`,
            ),
        ];
    });
}

async function detectDocstringStyle(session: Session, path: string): Promise<PythonDocstringStyle | undefined> {
    const module = await parsePythonModule(path, readCachedText(session.reads, path), session);
    try {
        for (const node of module.tree.rootNode.descendantsOfType(['function_definition', 'class_definition'])) {
            const docstring = findDocstring(node);
            if (docstring === undefined) continue;
            if (GOOGLE_DOCSTRING.test(docstring)) return 'google';
            if (NUMPY_DOCSTRING.test(docstring)) return 'numpy';
        }
        return undefined;
    } finally {
        module.tree.delete();
    }
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
function parsePydoclintOptions(path: string, text: string, convention: unknown): PydoclintOptions {
    const { tool } = parseTomlFile(path, text, docstringStyleSchema);
    const inherited = tool.ruff.lint.pydocstyle.convention ?? convention;
    const style = tool.pydoclint.style ?? (inherited === 'google' || inherited === 'numpy' ? inherited : undefined);
    const written = new Set(Object.keys(tool.pydoclint).map((name) => name.replaceAll('_', '-')));
    const defaults = PYDOCLINT_TYPE_OPTIONS.flatMap((name) => (written.has(name) ? [] : [`--${name}`, 'false']));
    return { command: [...PYDOCLINT_COMMAND, ...defaults], style };
}

/**
Runs pydoclint with the declared docstring style, or with the style each file uses.

@param session the repository and installed tools.
@param planned the docstring check for one scope.
@returns the check result, with earlier findings kept when a later batch fails.
*/
export async function checkPythonPydoclint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const configured = parsePydoclintOptions(
        joinScope(planned.scope.folder.path, PYPROJECT_TOML),
        findCachedText(session.reads, joinScope(planned.scope.folder.path, PYPROJECT_TOML)) ?? '',
        planned.scope.settings.values['tools.ruff']?.docstring_convention,
    );
    const groups = await groupByDocstringStyle(session, planned.files, configured.style);
    return runCommandGroups(
        session,
        planned,
        [...groups].map(([style, files]) => ({
            files,
            command: [...configured.command, PYDOCLINT_STYLE_FLAG, style ?? PYDOCLINT_DEFAULT_STYLE],
        })),
    );
}

function parseVultureFinding(planned: PlannedCheck, line: string, selected: ReadonlySet<string>): Finding[] {
    const groups = VULTURE_FINDING.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = groups['file'] ?? '';
    if (!selected.has(file)) return [];
    const at = { file, line: Number(groups['line']) };
    const { kind, name, statement } = groups;
    if (kind === undefined || name === undefined)
        return [
            buildFinding(planned, at, 'unreachable-code', `The code after ${String(statement)} never runs. Delete it.`),
        ];
    const message = `No code uses the ${kind} ${name}. Delete it, or, when code that vulture cannot see uses it by name, record that with gspot ignore python/vulture --names ${name} and a reason.`;
    return [{ ...buildFinding(planned, at, `unused-${kind}`, message), name }];
}

/**
Runs vulture over every Python file of the scope, so that a use in any file counts, and reports the findings in the
files of this run.

@param session the repository and its tools.
@param planned the scope, its files, and the repository files.
@returns each unused definition and each line of unreachable code.
*/
export async function checkPythonVulture(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const scope = planned.scope.folder.path;
    const children = listChildScopes(session.scopes, planned.scope);
    const sources = session.repository.files
        .filter((file) => file.kind === 'source' && file.path.endsWith('.py'))
        .filter((file) => isInScope(file.path, scope) && children.every((child) => !isInScope(file.path, child)))
        .map((file) => file.path);
    if (sources.length === 0) return [];
    const result = await runCheckTool(session, planned, [...VULTURE_COMMAND, ...sources], { cwd: session.root });
    const selected = new Set(planned.files.map((file) => file.path));
    const findings = result.stdout.split('\n').flatMap((line) => parseVultureFinding(planned, line, selected));
    return result.code === VULTURE_DEAD_CODE ? findings : assertToolFindings(result, findings, 'vulture');
}
