import { posix } from 'node:path';
import { relative } from 'node:path/posix';
import { find } from '#cli/system/files/reads.ts';
import { stringify } from '@decimalturn/toml-patch';
import { UV_LOCKFILE } from '#cli/config/manifests.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { pyprojectSchema } from '#cli/schemas/parsers.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { listOffRules } from '#cli/configurations/rule-options.ts';
import { DEFAULT_QUOTES } from '#cli/config/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { JSON_INDENT, CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import { getTable, getLimit, listIgnores, selectFormat } from '#cli/settings/scopes.ts';
import { convertToGlobs, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';

import {
    RUFF_CHECK,
    RUFF_ISORT,
    PYTHON_FILES,
    RUFF_PATH_RULES,
    PYDANTIC_PACKAGE,
    RUFF_TIDY_IMPORTS,
    RUFF_CONSOLE_RULES,
    RUFF_RUNTIME_TYPES,
    BASEDPYRIGHT_CHECK,
    BASEDPYRIGHT_LEVELS,
    BASEDPYRIGHT_OPTIONS,
    FASTAPI_CONFIGURATION,
    BASEDPYRIGHT_DEFAULT_OPTIONS,
    BASEDPYRIGHT_ALL_LEVEL_OPTIONS,
} from '#cli/config/configurations/python.ts';

function listIgnoredGlobs(planned: PlannedConfig, checkId: string, root: string): string[] {
    const shared = convertToGlobs(planned.ignoreSections).filter(
        (pattern) =>
            pattern.endsWith('/**') ||
            planned.configuration.files.extensions.some((extension) => pattern.endsWith(extension)),
    );
    const own = listCheckIgnoreSections(planned.scope.settings, checkId).flatMap(({ patterns }) => patterns);
    return [...shared, ...own].map((path) => `${root}/${path}`);
}

/**
Build basedpyright.json: the Python environment and source paths used by Basedpyright.

@param planned the config file to build.
*/
export function buildBasedpyrightFile(planned: PlannedConfig): string {
    const root = posix.relative(posix.dirname(planned.targetPath), '.');
    const pythonScopePath = posix.join(root, planned.scope.path);
    const pythonVenv = planned.session.repository.files.some(
        (file) => file.path === joinScope(planned.scope.path, UV_LOCKFILE),
    )
        ? PYTHON_ENVIRONMENT_FOLDER
        : undefined;
    const extraPaths = planned.scope.settings.tables.python?.import_folders ?? [];
    return JSON.stringify(
        {
            ...BASEDPYRIGHT_OPTIONS,
            ...(planned.level === 'all' ? BASEDPYRIGHT_ALL_LEVEL_OPTIONS : BASEDPYRIGHT_DEFAULT_OPTIONS),
            typeCheckingMode: BASEDPYRIGHT_LEVELS[planned.level],
            ...(pythonVenv !== undefined && { venvPath: pythonScopePath, venv: pythonVenv }),
            include: [pythonScopePath],
            extraPaths: [pythonScopePath, ...extraPaths.map((path) => posix.join(root, path))],
            exclude: listIgnoredGlobs(planned, BASEDPYRIGHT_CHECK, root),
        },
        null,
        JSON_INDENT,
    );
}

function listConsoleModules(planned: PlannedConfig): string[] {
    const pyproject = joinScope(planned.scope.path, PYPROJECT_TOML);
    const text = find(planned.session.cache, pyproject);
    if (text === undefined) return [];
    const scripts = parseTomlFile(pyproject, text, pyprojectSchema).project?.scripts;
    if (scripts === undefined) return [];
    return Object.values(scripts).map((target) => (target.split(':', 1)[0] as string).replaceAll('.', '/'));
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
Build ruff.toml: the Ruff lint rules, import settings, and source exclusions.

@param planned the config file to build.
*/
export function buildRuffFile(planned: PlannedConfig): string {
    const format = selectFormat(planned.scope.settings, PYTHON_FILES);
    const root = posix.relative(posix.dirname(planned.targetPath), '.');
    const pythonScopePath = posix.join(root, planned.scope.path);
    const ruffRules = planned.scope.configurations.flatMap((configuration) => [
        ...configuration.ruff.basic,
        ...(planned.level === 'all' ? configuration.ruff.all : []),
    ]);
    const scope = planned.scope.path;
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
        const target = `${pythonScopePath}/${relative(scope, path)}`;
        byPath.set(target, [...(byPath.get(target) ?? []), rule]);
    }
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
            select: ruffRules,
            ignore: listOffRules(planned),
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
