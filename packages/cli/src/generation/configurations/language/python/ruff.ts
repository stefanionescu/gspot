import { posix } from 'node:path';
import { relative } from 'node:path/posix';
import { stringify } from '@decimalturn/toml-patch';
import { stripUndefined } from '#cli/system/tables.ts';
import type { FormatSettings } from '#cli/types/settings/file.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { listPythonIgnoredGlobs } from '#cli/generation/config-files/ignore-files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/config-files/build.ts';
import { getTable, getLimit, listIgnores, listIgnoredRules } from '#cli/settings/scopes.ts';
import { DEFAULT_QUOTES } from '#cli/config/generation/configurations/general/format/prettier.ts';

import {
    RUFF_ISORT,
    PYTHON_FILES,
    RUFF_ALWAYS_OFF,
} from '#cli/config/generation/configurations/language/python/ruff.ts';

// Ruff takes one style for every Python file, so a format override that names every Python file sets it.
function selectPythonFormat(scopeSettings: PlannedConfigFile['scope']['settings']): FormatSettings {
    const override = scopeSettings.values.format.override.find(({ paths }) =>
        paths.every((path) => (PYTHON_FILES as readonly string[]).includes(path)),
    );
    if (override === undefined) return scopeSettings.values.format;
    const { paths: _paths, ...fields } = override;
    return { ...scopeSettings.values.format, ...stripUndefined(fields) };
}

/**
 * Build ruff.toml: the Ruff lint rules, import settings, and source exclusions.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the Ruff lint rules, import settings, and source exclusions.
 */
export function buildRuffFile(planned: PlannedConfigFile): string {
    const format = selectPythonFormat(planned.scope.settings);
    const pythonScopePath = posix.join(
        posix.relative(posix.dirname(planned.targetPath), '.'),
        planned.scope.folder.path,
    );
    const ruffRules = planned.scope.configurations.flatMap((configuration) => [
        ...configuration.ruff.recommended,
        ...(planned.level === 'all' ? configuration.ruff.all : []),
    ]);
    const scope = planned.scope.folder.path;
    const off = listIgnoredRules(planned.scope, 'python/ruff');
    const perFile = listIgnores(planned.scope.settings, 'python/ruff').filter(
        (entry) => entry.rule !== undefined && entry.paths.length > 0,
    );
    const byPath = new Map<string, string[]>();
    const pathRules = perFile.flatMap((entry) => entry.paths.map((path) => ({ path, rule: entry.rule as string })));
    for (const { path, rule } of pathRules) {
        const target = `${pythonScopePath}/${relative(scope, path)}`;
        byPath.set(target, [...(byPath.get(target) ?? []), rule]);
    }
    const convention = getTable(planned.scope.settings, 'tools.ruff').docstring_convention;
    const document = {
        'line-length': format.print_width,
        'indent-width': format.indent_width,
        'extend-exclude': listPythonIgnoredGlobs(planned, 'python/ruff'),
        format: {
            'indent-style': format.indent_style === 'tab' ? 'tab' : 'space',
            'quote-style': format.quotes ?? DEFAULT_QUOTES.ruff,
            'line-ending': format.line_ending === 'crlf' ? 'cr-lf' : 'lf',
            'docstring-code-format': true,
        },
        lint: {
            select: ruffRules,
            ignore: [...off, ...RUFF_ALWAYS_OFF],
            isort: RUFF_ISORT,
            mccabe: { 'max-complexity': getLimit(planned.scope.settings, 'cyclomatic_complexity', 'python') },
            ...(convention === undefined ? {} : { pydocstyle: { convention } }),
            pylint: {
                'max-statements': getLimit(planned.scope.settings, 'function_statements', 'python'),
                'max-args': getLimit(planned.scope.settings, 'function_parameters', 'python'),
                'max-positional-args': getLimit(planned.scope.settings, 'function_parameters', 'python'),
                'max-branches': getLimit(planned.scope.settings, 'function_branches', 'python'),
                'max-returns': getLimit(planned.scope.settings, 'function_returns', 'python'),
            },
            ...(byPath.size === 0 ? {} : { 'per-file-ignores': Object.fromEntries(byPath) }),
        },
    };

    return stringify(document, CONFIG_FILE_TOML_FORMAT);
}
