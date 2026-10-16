import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { relative } from 'node:path/posix';
import { stringify } from '@decimalturn/toml-patch';
import { type Session } from '#cli/types/planning.ts';
import { generatedIgnores } from '#cli/generation/ignore-files.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { TOOL_FILE_DIRECTORY } from '#cli/config/system/locations.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/generation/tool-file-sources.ts';
import { type PythonInputs, type GenerationInputs } from '#cli/types/generation/files.ts';
import { RUFF_ISORT, RUFF_IGNORED_RULES, BASEDPYRIGHT_OPTIONS } from '#cli/config/generation/python.ts';

/**
 * Resolve Python configuration paths for both type and lint tools.
 *
 * @param session the repository and settings.
 * @param selection the scope receiving this generated file.
 *
 * @returns the scope's environment and configuration-relative exclusions.
 */
function buildPythonInputs(
    session: Pick<Session, 'root' | 'installedRoot' | 'settingsFile' | 'reads' | 'repository' | 'scopes'>,
    selection: ScopeSelection,
): PythonInputs {
    const root = session.installedRoot;
    const { settings } = session.settingsFile;
    const base = posix.relative(posix.join(TOOL_FILE_DIRECTORY, selection.scope.path), '.');
    const exclusions = generatedIgnores(session);
    return {
        ruffRules: selection.selected.flatMap((manifest) => [
            ...manifest.ruff.recommended,
            ...(settings.level === 'all' ? manifest.ruff.all : []),
        ]),
        pythonScopePath: posix.join(base, selection.scope.path),
        pythonVenv:
            statSync(join(root, selection.scope.path, '.venv'), { throwIfNoEntry: false })?.isDirectory() === true
                ? '.venv'
                : undefined,
        pythonExcludes: (check: string) =>
            [
                ...exclusions,
                ...selection.view
                    .ignoresFor(check)
                    .filter((entry) => entry.rule === undefined)
                    .flatMap((entry) => entry.paths),
            ].map((path) => `${base}/${path}`),
    };
}

/**
 * Write the ruff configuration from selected settings.
 *
 * @param input the source values.
 *
 * @returns the generated configuration text.
 */
export function buildRuffFile(
    input: Pick<GenerationInputs, 'selection' | 'scopes'> &
        Pick<Session, 'root' | 'installedRoot' | 'settingsFile' | 'reads' | 'repository'>,
): string {
    const { settings, format, limit, ignoresFor, rulesOff } = input.selection.view;
    const { pythonScopePath, pythonExcludes, ruffRules } = buildPythonInputs(input, input.selection);
    const scope = input.selection.scope.path;
    const off = rulesOff('python/ruff');
    const perFile = ignoresFor('python/ruff').filter((entry) => entry.rule !== undefined && entry.paths.length > 0);
    const byPath = new Map<string, string[]>();
    const pathRules = perFile.flatMap((entry) => entry.paths.map((path) => ({ path, rule: entry.rule as string })));
    for (const { path, rule } of pathRules) {
        const target = `${pythonScopePath}/${relative(scope, path)}`;
        byPath.set(target, [...(byPath.get(target) ?? []), rule]);
    }
    const convention = settings['tools.ruff.docstring_convention'];
    const document = {
        'line-length': format.print_width,
        'indent-width': format.indent_width,
        'extend-exclude': pythonExcludes('python/ruff'),
        format: {
            'indent-style': format.indent_style === 'tab' ? 'tab' : 'space',
            'quote-style': format.quotes,
            'line-ending': format.line_ending === 'crlf' ? 'cr-lf' : 'lf',
            'docstring-code-format': true,
        },
        lint: {
            select: ruffRules,
            ignore: [...off, ...RUFF_IGNORED_RULES],
            isort: RUFF_ISORT,
            mccabe: { 'max-complexity': limit('cyclomatic_complexity', 'python') },
            ...(convention === undefined ? {} : { pydocstyle: { convention } }),
            pylint: {
                'max-statements': limit('statements', 'python'),
                'max-args': limit('function_parameters', 'python'),
                'max-positional-args': limit('function_parameters', 'python'),
                'max-branches': limit('branches', 'python'),
                'max-returns': limit('returns', 'python'),
            },
            ...(byPath.size === 0 ? {} : { 'per-file-ignores': Object.fromEntries(byPath) }),
        },
    };

    return `${stringify(document, TOOL_EMIT_FORMAT).trimEnd()}\n`;
}

/**
 * Write the basedpyright configuration from selected settings.
 *
 * @param input the source values.
 *
 * @returns the generated configuration text.
 */
export function buildBasedpyrightFile(
    input: Pick<GenerationInputs, 'selection' | 'scopes'> &
        Pick<Session, 'root' | 'installedRoot' | 'settingsFile' | 'reads' | 'repository'>,
): string {
    const { pythonVenv, pythonScopePath, pythonExcludes } = buildPythonInputs(input, input.selection);
    const isAll = input.settingsFile.settings.level === 'all';
    return (
        JSON.stringify(
            {
                ...BASEDPYRIGHT_OPTIONS[isAll ? 'all' : 'recommended'],
                ...(pythonVenv === undefined ? {} : { venvPath: pythonScopePath, venv: pythonVenv }),
                include: [pythonScopePath],
                extraPaths: [pythonScopePath],
                exclude: pythonExcludes('python/basedpyright'),
            },
            null,
            JSON_INDENT,
        ) + '\n'
    );
}
