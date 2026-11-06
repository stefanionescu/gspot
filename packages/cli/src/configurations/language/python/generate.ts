import { posix } from 'node:path';
import { relative } from 'node:path/posix';

import { stringify } from '@decimalturn/toml-patch';

import { DEFAULT_QUOTES } from '#cli/config/configurations/general.ts';
import {
    BASEDPYRIGHT_ALL_LEVEL_OPTIONS,
    BASEDPYRIGHT_CHECK,
    BASEDPYRIGHT_DEFAULT_OPTIONS,
    BASEDPYRIGHT_LEVELS,
    BASEDPYRIGHT_OPTIONS,
    FASTAPI_CONFIGURATION,
    PYDANTIC_PACKAGE,
    PYTHON_FILES,
    RUFF_CONSOLE_RULES,
    RUFF_ISORT,
    RUFF_PATH_RULES,
    RUFF_RUNTIME_TYPES,
    RUFF_TIDY_IMPORTS,
} from '#cli/config/configurations/python.ts';
import { UV_LOCKFILE } from '#cli/config/manifests.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { RUFF_CHECK } from '#cli/config/repository/setup.ts';
import { GLOB_EXCLUSION, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { CONFIG_TOML_FORMAT, JSON_INDENT } from '#cli/config/tools/installers.ts';
import { convertToGlobs, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { pyprojectSchema } from '#cli/schemas/parsers.ts';
import { getLimit, getTable, listIgnoredRules, listIgnores, selectFormat } from '#cli/settings/scopes.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isInScope } from '#cli/system/paths.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

const MINIMUM_PYTHON = /(?:>=|~=|==)\s*(?<version>\d+\.\d+)/u;

// F401 reports a side-effect import as unused, such as import readline, and its fix deletes the import.
const RUFF_UNFIXABLE = ['F401'];

function listIgnoredGlobs(planned: PlannedConfig, checkId: string, root: string): string[] {
    const shared = convertToGlobs(planned.ignoreSections).filter(
        (pattern) =>
            pattern.endsWith('/**') ||
            planned.configuration.files.extensions.some((extension) => pattern.endsWith(extension)),
    );
    const own = listCheckIgnoreSections(planned.scope.settings, checkId)
        .filter(({ patterns }) => !patterns.some((pattern) => GLOB_EXCLUSION.test(pattern)))
        .flatMap(({ patterns }) => patterns);
    return [...shared, ...own].map((path) => `${root}/${path}`);
}

function readMinimumPython(planned: PlannedConfig): string | undefined {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const text = findText(planned.session.cache, pyproject);
    if (text === undefined) return undefined;
    const project = tryParseFile(() => parseTomlFile(pyproject, text, pyprojectSchema))?.project;
    return MINIMUM_PYTHON.exec(project?.['requires-python'] ?? '')?.groups?.['version'];
}

function listConsoleModules(planned: PlannedConfig): string[] {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const text = findText(planned.session.cache, pyproject);
    if (text === undefined) return [];
    const scripts = tryParseFile(() => parseTomlFile(pyproject, text, pyprojectSchema))?.project?.scripts;
    return scripts === undefined
        ? []
        : Object.values(scripts).map((target) => (target.split(':', 1)[0] as string).replaceAll('.', '/'));
}

function buildRuntimeTypeOptions(planned: PlannedConfig): Record<string, unknown> {
    const { configurations } = planned.scope.settings;
    const { dependencyFiles } = planned.session.repository;
    const hasPydantic = dependencyFiles.some(
        (file) => isInScope(file.path, planned.scope.path) && file.dependencies[PYDANTIC_PACKAGE] !== undefined,
    );
    return hasPydantic || configurations.includes(FASTAPI_CONFIGURATION)
        ? { 'flake8-type-checking': RUFF_RUNTIME_TYPES }
        : {};
}

/**
Build basedpyright.json: the Python environment and source paths used by Basedpyright.

@param planned the config file to build.
*/
function buildBasedpyrightFile(planned: PlannedConfig): string {
    const root = posix.relative(posix.dirname(planned.targetPath), '.');
    const pythonScopePath = posix.join(root, planned.scope.path);
    const pythonVenv = planned.session.repository.files.some(
        (file) => file.path === joinScope(planned.scope.path, UV_LOCKFILE),
    )
        ? PYTHON_ENVIRONMENT_FOLDER
        : undefined;
    const extraPaths = planned.scope.settings.tables.python?.import_folders ?? [];
    const pythonVersion = readMinimumPython(planned);
    const nested = listNestedScopes(
        planned.session.scopes.map((scope) => scope.path),
        planned.scope.path,
    );
    return JSON.stringify(
        {
            ...BASEDPYRIGHT_OPTIONS,
            ...(planned.level === 'all' ? BASEDPYRIGHT_ALL_LEVEL_OPTIONS : BASEDPYRIGHT_DEFAULT_OPTIONS),
            typeCheckingMode: BASEDPYRIGHT_LEVELS[planned.level],
            ...(pythonVenv !== undefined && { venvPath: pythonScopePath, venv: pythonVenv }),
            include: [pythonScopePath],
            extraPaths: [pythonScopePath, ...extraPaths.map((path) => posix.join(root, path))],
            ...(pythonVersion !== undefined && { pythonVersion }),
            exclude: [
                ...listIgnoredGlobs(planned, BASEDPYRIGHT_CHECK, root),
                ...nested.map((path) => posix.join(root, path)),
            ],
        },
        null,
        JSON_INDENT,
    );
}

/**
Build ruff.toml: the Ruff lint rules, import settings, and source exclusions.

@param planned the config file to build.
*/
function buildRuffFile(planned: PlannedConfig): string {
    const format = selectFormat(planned.scope.settings, PYTHON_FILES);
    const root = posix.relative(posix.dirname(planned.targetPath), '.');
    const pythonScopePath = posix.join(root, planned.scope.path);
    const ruffRules = planned.scope.configurations.flatMap((configuration) => [
        ...configuration.ruff.basic,
        ...(planned.level === 'all' ? configuration.ruff.all : []),
    ]);
    const perFile = listIgnores(planned.scope.settings, RUFF_CHECK).filter(
        (each) => each.rule !== undefined && each.paths !== undefined,
    );
    const byPath = new Map<string, string[]>([
        ...Object.entries(RUFF_PATH_RULES).map(([path, rules]): [string, string[]] => [`${root}/${path}`, [...rules]]),
        ...listConsoleModules(planned).map((module): [string, string[]] => [
            `${pythonScopePath}/**/${module}.py`,
            [...RUFF_CONSOLE_RULES],
        ]),
    ]);
    const pathRules = perFile.flatMap((ignore) =>
        (ignore.paths ?? []).map((path) => ({ path, rule: ignore.rule as string })),
    );
    for (const { path, rule } of pathRules) {
        const target = `${pythonScopePath}/${relative(planned.scope.path, path)}`;
        byPath.set(target, [...(byPath.get(target) ?? []), rule]);
    }
    const written = getTable(planned.scope.settings, 'tools.ruff').rules;
    const ignored = listIgnoredRules(planned.scope, RUFF_CHECK);
    const convention = getTable(planned.scope.settings, 'python').docstring_convention;
    const document = {
        'line-length': format.print_width,
        'indent-width': format.indent_width,
        'extend-exclude': listIgnoredGlobs(planned, RUFF_CHECK, root),
        format: {
            'indent-style': format.indent_style === 'tab' ? 'tab' : 'space',
            'quote-style': format.quotes ?? DEFAULT_QUOTES.ruff,
            'line-ending': 'lf',
            'docstring-code-format': true,
        },
        lint: {
            preview: true,
            'explicit-preview-rules': true,
            select: [...ruffRules, ...written],
            ignore: listDisabledRules(planned).filter((rule) => ignored.includes(rule) || !written.includes(rule)),
            unfixable: RUFF_UNFIXABLE,
            isort: RUFF_ISORT,
            'flake8-tidy-imports': RUFF_TIDY_IMPORTS,
            mccabe: { 'max-complexity': getLimit(planned.scope.settings, 'max_cyclomatic_complexity', 'python') },
            ...(convention !== undefined && { pydocstyle: { convention } }),
            ...buildRuntimeTypeOptions(planned),
            pylint: {
                'max-statements': getLimit(planned.scope.settings, 'max_function_statements', 'python'),
                'max-args': getLimit(planned.scope.settings, 'max_function_parameters', 'python'),
                'max-branches': getLimit(planned.scope.settings, 'max_function_branches', 'python'),
                'max-returns': getLimit(planned.scope.settings, 'max_function_returns', 'python'),
            },
            'per-file-ignores': Object.fromEntries(byPath),
        },
    };

    return stringify(document, CONFIG_TOML_FORMAT);
}

export const PYTHON_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'python/basedpyright.json': buildBasedpyrightFile,
    'python/ruff.toml': buildRuffFile,
};
