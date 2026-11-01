import { posix } from 'node:path';
import { relative } from 'node:path/posix';
import { stringify } from '@decimalturn/toml-patch';
import { joinScope } from '#cli/repository/scopes.ts';
import { UV_LOCKFILE } from '#cli/config/manifests.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { DEFAULT_QUOTES } from '#cli/config/configurations/general.ts';
import { JSON_INDENT, CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import { convertToGlobs, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import type { PlannedConfig, FormatSettings } from '#cli/types/configurations/language.ts';
import { getTable, getLimit, isEveryPath, listIgnores, listIgnoredRules } from '#cli/settings/scopes.ts';

import {
    RUFF_TABLE,
    RUFF_CHECK,
    RUFF_ISORT,
    PYTHON_FILES,
    RUFF_ALWAYS_OFF,
    BASEDPYRIGHT_CHECK,
    BASEDPYRIGHT_LEVELS,
    BASEDPYRIGHT_OPTIONS,
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

function selectPythonFormat(
    scopeSettings: PlannedConfig['scope']['settings'],
): Pick<FormatSettings, 'indent_style' | 'indent_width' | 'print_width' | 'quotes'> {
    const format = scopeSettings.tables.format;
    const override = format.override.find(({ paths }) =>
        paths.every((path) => (PYTHON_FILES as readonly string[]).includes(path)),
    );
    if (override === undefined) return format;
    return {
        indent_style: override.indent_style ?? format.indent_style,
        indent_width: override.indent_width ?? format.indent_width,
        print_width: override.print_width ?? format.print_width,
        quotes: override.quotes ?? format.quotes,
    };
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

/**
Build ruff.toml: the Ruff lint rules, import settings, and source exclusions.

@param planned the config file to build.
*/
export function buildRuffFile(planned: PlannedConfig): string {
    const format = selectPythonFormat(planned.scope.settings);
    const root = posix.relative(posix.dirname(planned.targetPath), '.');
    const pythonScopePath = posix.join(root, planned.scope.path);
    const ruffRules = planned.scope.configurations.flatMap((configuration) => [
        ...configuration.ruff.basic,
        ...(planned.level === 'all' ? configuration.ruff.all : []),
    ]);
    const scope = planned.scope.path;
    const off = listIgnoredRules(planned.scope, RUFF_CHECK);
    const perFile = listIgnores(planned.scope.settings, RUFF_CHECK).filter(
        (each) => each.rule !== undefined && !isEveryPath(each),
    );
    const byPath = new Map<string, string[]>();
    const pathRules = perFile.flatMap((ignore) =>
        (ignore.paths ?? []).map((path) => ({ path, rule: ignore.rule as string })),
    );
    for (const { path, rule } of pathRules) {
        const target = `${pythonScopePath}/${relative(scope, path)}`;
        byPath.set(target, [...(byPath.get(target) ?? []), rule]);
    }
    const convention = getTable(planned.scope.settings, RUFF_TABLE).docstring_convention;
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
            select: ruffRules,
            ignore: [...off, ...RUFF_ALWAYS_OFF],
            isort: RUFF_ISORT,
            mccabe: { 'max-complexity': getLimit(planned.scope.settings, 'cyclomatic_complexity', 'python') },
            ...(convention !== undefined && { pydocstyle: { convention } }),
            pylint: {
                'max-statements': getLimit(planned.scope.settings, 'function_statements', 'python'),
                'max-args': getLimit(planned.scope.settings, 'function_parameters', 'python'),
                'max-positional-args': getLimit(planned.scope.settings, 'function_parameters', 'python'),
                'max-branches': getLimit(planned.scope.settings, 'function_branches', 'python'),
                'max-returns': getLimit(planned.scope.settings, 'function_returns', 'python'),
            },
            ...(byPath.size > 0 && { 'per-file-ignores': Object.fromEntries(byPath) }),
        },
    };

    return stringify(document, CONFIG_TOML_FORMAT);
}
