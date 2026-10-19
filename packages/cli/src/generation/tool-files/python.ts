import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { relative } from 'node:path/posix';
import { stringify } from '@decimalturn/toml-patch';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { TOML_FORMAT } from '#cli/config/generation/tool-files.ts';
import { DEFAULT_QUOTES } from '#cli/config/generation/formatting.ts';
import { buildGlobSections, buildIgnoreSections } from '#cli/generation/ignore-files.ts';
import { type PythonInputs, type ToolFileContext } from '#cli/types/generation/files.ts';
import { RUFF_ISORT, RUFF_IGNORED_RULES, BASEDPYRIGHT_OPTIONS } from '#cli/config/generation/python.ts';

/**
 * Resolve the Python paths for the type checker and the linter.
 *
 * @param context the tool file to build.
 * @returns the environment of the scope, and the exclusions relative to the tool file.
 */
function buildPythonInputs(context: ToolFileContext): PythonInputs {
    const { session, selection, level } = context;
    const root = session.installedRoot;
    const base = posix.relative(posix.dirname(context.targetPath), '.');
    // Ruff and basedpyright read only Python files. Give them folders and Python file patterns only.
    const exclusions = buildGlobSections(buildIgnoreSections(session)).filter(
        (pattern) =>
            pattern.endsWith('/**') ||
            context.manifest.files.extensions.some((extension) => pattern.endsWith(extension)),
    );
    return {
        ruffRules: selection.selected.flatMap((manifest) => [
            ...manifest.ruff.recommended,
            ...(level === 'all' ? manifest.ruff.all : []),
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
 * Build the Ruff file from the settings.
 * @param context the tool file to build.
 * @returns the Ruff lint rules, import settings, and source exclusions.
 */
function buildRuffFile(context: ToolFileContext): string {
    const { settings, format, limit, ignoresFor, rulesOff } = context.selection.view;
    const { pythonScopePath, pythonExcludes, ruffRules } = buildPythonInputs(context);
    const scope = context.selection.scope.path;
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
            'quote-style': format.quotes ?? DEFAULT_QUOTES.ruff,
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
                'max-statements': limit('function_statements', 'python'),
                'max-args': limit('function_parameters', 'python'),
                'max-positional-args': limit('function_parameters', 'python'),
                'max-branches': limit('function_branches', 'python'),
                'max-returns': limit('function_returns', 'python'),
            },
            ...(byPath.size === 0 ? {} : { 'per-file-ignores': Object.fromEntries(byPath) }),
        },
    };

    return `${stringify(document, TOML_FORMAT).trimEnd()}\n`;
}
/**
 * Build the Basedpyright file from the settings.
 * @param context the tool file to build.
 * @returns the Python environment and source paths used by Basedpyright.
 */
function buildBasedpyrightFile(context: ToolFileContext): string {
    const { pythonVenv, pythonScopePath, pythonExcludes } = buildPythonInputs(context);
    return (
        JSON.stringify(
            {
                ...BASEDPYRIGHT_OPTIONS,
                typeCheckingMode: context.level,
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

export { buildRuffFile, buildBasedpyrightFile };
