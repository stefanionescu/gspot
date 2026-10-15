import { relative } from 'node:path/posix';
import { stringify } from '@decimalturn/toml-patch';
import type { Session } from '#cli/types/planning.ts';
import { pythonInputs } from '#cli/generation/python.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/generation/tool-file-sources.ts';
import type { EmitInputs, ToolFileSource } from '#cli/types/generation/files.ts';
import { RUFF_ISORT, RUFF_IGNORED_RULES } from '#cli/config/generation/python.ts';

/**
 * Write the ruff configuration from selected settings.
 *
 * @param input the source values.
 *
 * @returns the generated configuration text.
 */
export function ruffToolFile(
    input: Pick<EmitInputs, 'selection' | 'scopes'> &
        Pick<Session, 'root' | 'installedRoot' | 'settingsFile' | 'reads' | 'repository'>,
): ToolFileSource {
    const { settings, format, limit, ignoresFor, rulesOff } = input.selection.view;
    const { pythonScopePath, pythonExcludes, ruffRules } = pythonInputs(input, input.selection);
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
                'max-args': limit('function_parameters', 'python'),
                'max-positional-args': limit('function_parameters', 'python'),
                'max-branches': limit('branches', 'python'),
                'max-returns': limit('returns', 'python'),
            },
            ...(byPath.size === 0 ? {} : { 'per-file-ignores': Object.fromEntries(byPath) }),
        },
    };

    return { content: `${stringify(document, TOOL_EMIT_FORMAT).trimEnd()}\n`, document: document };
}
