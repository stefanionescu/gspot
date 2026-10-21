import { posix } from 'node:path';
import { relative } from 'node:path/posix';
import { stringify } from '@decimalturn/toml-patch';
import { joinScope } from '#cli/repository/scopes.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { PYTHON_FILES } from '#cli/config/commands/init.ts';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { TOML_FORMAT } from '#cli/config/generation/settings.ts';
import type { FormatSettings } from '#cli/types/settings/file.ts';
import { DEFAULT_QUOTES } from '#cli/config/generation/formatting.ts';
import { PROJECT_UV_LOCKFILE } from '#cli/config/system/locations.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';
import { listPythonIgnoredGlobs } from '#cli/generation/ignore-files.ts';
import { getTable, getLimit, listIgnores, listIgnoredRules } from '#cli/settings/scope-view.ts';

import {
    RUFF_ISORT,
    RUFF_IGNORED_RULES,
    BASEDPYRIGHT_OPTIONS,
    BASEDPYRIGHT_ALL_LEVEL_OPTIONS,
} from '#cli/config/generation/python.ts';

// Ruff takes one style for every Python file, so a format override that names every Python file sets it.
function selectPythonFormat(view: ToolFileContext['selection']['view']): FormatSettings {
    const override = view.values.format.override.find(({ paths }) =>
        paths.every((path) => (PYTHON_FILES as readonly string[]).includes(path)),
    );
    if (override === undefined) return view.values.format;
    const { paths: _paths, ...fields } = override;
    return { ...view.values.format, ...stripUndefined(fields) };
}

/**
 * Build the Ruff file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Ruff lint rules, import settings, and source exclusions.
 */
function buildRuffFile(context: ToolFileContext): string {
    const format = selectPythonFormat(context.selection.view);
    const pythonScopePath = posix.join(
        posix.relative(posix.dirname(context.targetPath), '.'),
        context.selection.scope.path,
    );
    const ruffRules = context.selection.selected.flatMap((manifest) => [
        ...manifest.ruff.recommended,
        ...(context.level === 'all' ? manifest.ruff.all : []),
    ]);
    const scope = context.selection.scope.path;
    const off = listIgnoredRules(context.selection, 'python/ruff');
    const perFile = listIgnores(context.selection.view, 'python/ruff').filter(
        (entry) => entry.rule !== undefined && entry.paths.length > 0,
    );
    const byPath = new Map<string, string[]>();
    const pathRules = perFile.flatMap((entry) => entry.paths.map((path) => ({ path, rule: entry.rule as string })));
    for (const { path, rule } of pathRules) {
        const target = `${pythonScopePath}/${relative(scope, path)}`;
        byPath.set(target, [...(byPath.get(target) ?? []), rule]);
    }
    const convention = getTable(context.selection.view, 'tools.ruff').docstring_convention;
    const document = {
        'line-length': format.print_width,
        'indent-width': format.indent_width,
        'extend-exclude': listPythonIgnoredGlobs(context, 'python/ruff'),
        format: {
            'indent-style': format.indent_style === 'tab' ? 'tab' : 'space',
            'quote-style': format.quotes ?? DEFAULT_QUOTES.ruff,
            'line-ending': format.line_ending === 'crlf' ? 'cr-lf' : 'lf',
            'docstring-code-format': true,
        },
        lint: {
            select: ruffRules,
            ignore: [...off, ...RUFF_IGNORED_RULES],
            isort: RUFF_ISORT,
            mccabe: { 'max-complexity': getLimit(context.selection.view, 'cyclomatic_complexity', 'python') },
            ...(convention === undefined ? {} : { pydocstyle: { convention } }),
            pylint: {
                'max-statements': getLimit(context.selection.view, 'function_statements', 'python'),
                'max-args': getLimit(context.selection.view, 'function_parameters', 'python'),
                'max-positional-args': getLimit(context.selection.view, 'function_parameters', 'python'),
                'max-branches': getLimit(context.selection.view, 'function_branches', 'python'),
                'max-returns': getLimit(context.selection.view, 'function_returns', 'python'),
            },
            ...(byPath.size === 0 ? {} : { 'per-file-ignores': Object.fromEntries(byPath) }),
        },
    };

    return stringify(document, TOML_FORMAT);
}
/**
 * Build the Basedpyright file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Python environment and source paths used by Basedpyright.
 */
function buildBasedpyrightFile(context: ToolFileContext): string {
    const pythonScopePath = posix.join(
        posix.relative(posix.dirname(context.targetPath), '.'),
        context.selection.scope.path,
    );
    // uv records the environment beside its tracked lockfile, even before the environment exists locally.
    const pythonVenv = context.session.repository.files.some(
        (file) => file.path === joinScope(context.selection.scope.path, PROJECT_UV_LOCKFILE),
    )
        ? PYTHON_ENVIRONMENT_FOLDER
        : undefined;
    const extraPaths = context.selection.view.values.python?.extra_paths ?? [];
    return JSON.stringify(
        {
            ...BASEDPYRIGHT_OPTIONS,
            ...(context.level === 'all' ? BASEDPYRIGHT_ALL_LEVEL_OPTIONS : {}),
            typeCheckingMode: context.level,
            ...(pythonVenv === undefined ? {} : { venvPath: pythonScopePath, venv: pythonVenv }),
            include: [pythonScopePath],
            extraPaths: [pythonScopePath, ...extraPaths.map((path) => posix.join(pythonScopePath, path))],
            exclude: listPythonIgnoredGlobs(context, 'python/basedpyright'),
        },
        null,
        JSON_INDENT,
    );
}

export { buildRuffFile, buildBasedpyrightFile };
