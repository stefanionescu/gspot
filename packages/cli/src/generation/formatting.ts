// The Prettier and EditorConfig settings a policy generates, with authored overrides carried along.
import { dirname, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { compact } from '#cli/platform/objects.ts';
import { everyTable } from '#cli/policy/settings/entries.ts';
import { UNREPRESENTABLE_SELECTOR } from '#cli/config/formatting.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/config/platform/locations.ts';
import { byScopeDepth, expandedPaths } from '#cli/repository/selectors.ts';
import type { Policy, FormatSettings } from '#cli/types/policy/settings.ts';
import { literalGlob, rebaseOverrides } from '#cli/generation/editorconfig.ts';

import type {
    ScopeFormat,
    PrettierInput,
    FormatOverride,
    NativeOverride,
    PrettierPlugin,
    EditorconfigOverride,
    PrettierPluginOptions,
} from '#cli/types/generation/formatting.ts';

function formatEntries(policy: Policy): ScopeFormat[] {
    const tables = everyTable(policy)
        .toSorted((first, second) => byScopeDepth(first.scope ?? '', second.scope ?? ''))
        .map(({ scope = '', table }) => ({ scope, format: table.format ?? {} }));
    const base = tables.flatMap(({ scope, format: { overrides: _overrides, ...format } }) =>
        scope === '' || Object.keys(format).length === 0 ? [] : [{ scope, paths: ['**/*'], format }],
    );
    const overrides = tables.flatMap(({ scope, format }) =>
        (format.overrides ?? []).map(({ paths, ...format }) => ({ scope, paths, format: compact(format) })),
    );
    return [...base, ...overrides];
}

// The overrides the policy's scoped and path-specific format settings become, relative to the generated file.
function policyOverrides(policy: Policy, fromConfig: (pattern: string) => string): FormatOverride[] {
    return formatEntries(policy).map(({ scope, paths, format }) => {
        const expanded = expandedPaths(paths);
        const files = expanded.filter((path) => !path.startsWith('!')).map((path) => fromConfig(path));
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => fromConfig(path.slice(1)));
        if (scope !== '') excludeFiles.push(`!${fromConfig(literalGlob(scope))}/**`);
        return { files, excludeFiles, options: prettierOptions(format) };
    });
}

// The plugins Prettier loads: the authored ones, then each shipped plugin by a path relative to the configuration file.
function pluginEntries(
    plugins: PrettierPlugin[],
    prefix: string,
    extras: Record<string, unknown>,
): PrettierPluginOptions {
    if (plugins.length === 0) return {};
    const base = prefix === '' ? '.' : prefix;
    const shipped = plugins.map((plugin) => `${base}/${NODE_MODULES_DIRECTORY}/${plugin.name}/${plugin.entry}`);
    return { plugins: [...((extras['plugins'] as string[] | undefined) ?? []), ...shipped] };
}

// A Prettier selector as an EditorConfig section path, placed under its scope when it has one.
function editorconfigSelector(pattern: string, scope: string): string {
    if (pattern.startsWith('!') || UNREPRESENTABLE_SELECTOR.test(pattern))
        throw new Error(
            `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in tools.prettier.verbatim.overrides or a native EditorConfig section.`,
        );
    if (scope === '' || pattern.startsWith(`${scope}/`)) return pattern;
    if (!pattern.startsWith('**/') || pattern.slice('**/'.length).includes('/'))
        throw new Error(
            `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scope}. Use a root-relative selector within that scope.`,
        );
    return `${literalGlob(scope)}/${pattern}`;
}

/**
 * The Prettier options for the format settings a policy states.
 * @param format the format settings, each optional
 * @returns the options Prettier reads, only for the settings given
 */
function prettierOptions(format: Partial<FormatSettings>): Record<string, unknown> {
    return {
        ...(format.indent_width === undefined ? {} : { tabWidth: format.indent_width }),
        ...(format.indent_style === undefined ? {} : { useTabs: format.indent_style === 'tab' }),
        ...(format.print_width === undefined ? {} : { printWidth: format.print_width }),
        ...(format.quotes === undefined ? {} : { singleQuote: format.quotes === 'single' }),
        ...(format.trailing_commas === undefined ? {} : { trailingComma: format.trailing_commas }),
        ...(format.semicolons === undefined ? {} : { semi: format.semicolons }),
        ...(format.line_ending === undefined ? {} : { endOfLine: format.line_ending }),
    };
}

/**
 * Generate each Prettier configuration relative to its own output path.
 * @param input effective formatting, authored overrides, applicable plugins, and the output path
 * @returns the Prettier configuration
 */
export function prettierConfiguration(input: PrettierInput): Record<string, unknown> {
    const { policy, format, targetPath, verbatim, plugins } = input;
    const prefix = toPosix(relative(dirname(targetPath), '.'));
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Every override path gets the scope folder prefix the same way.
    const fromConfig = (pattern: string): string => (prefix === '' ? pattern : `${prefix}/${pattern}`);
    const { overrides: nativeOverrides = [], ...extras } = verbatim ?? {};
    const overrides = [
        ...plugins.flatMap((plugin) => plugin.overrides),
        ...policyOverrides(policy, fromConfig),
        ...rebaseOverrides(nativeOverrides as NativeOverride<Record<string, unknown>>[], '', prefix),
    ];
    return {
        ...prettierOptions(format),
        arrowParens: 'always',
        embeddedLanguageFormatting: 'off',
        ...extras,
        ...pluginEntries(plugins, prefix, extras),
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}

/**
 * Emit representable EditorConfig selectors without expanding the current file inventory.
 * @param policy the repository policy
 * @returns one override per selector with the settings EditorConfig can express
 */
export function editorconfigOverrides(policy: Policy): EditorconfigOverride[] {
    return formatEntries(policy).flatMap(({ scope, paths, format }) => {
        const options = {
            ...(format.indent_style === undefined ? {} : { indent_style: format.indent_style }),
            ...(format.indent_width === undefined ? {} : { indent_size: format.indent_width }),
            ...(format.line_ending === undefined ? {} : { end_of_line: format.line_ending }),
            ...(format.final_newline === undefined ? {} : { insert_final_newline: format.final_newline }),
        };
        if (Object.keys(options).length === 0) return [];
        return expandedPaths(paths).map((pattern) => ({ path: `/${editorconfigSelector(pattern, scope)}`, options }));
    });
}
