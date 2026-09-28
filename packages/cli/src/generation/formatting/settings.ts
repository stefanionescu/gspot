// The Prettier and EditorConfig settings a policy generates, with authored overrides carried along.
import { dirname, relative } from 'node:path';
import { compact } from '#cli/policy/normalize.ts';
import { expandedPaths } from '#cli/repository/paths.ts';
import { shippedFormat } from '#cli/configurations/listing.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/constants/platform.ts';
import { UNREPRESENTABLE_SELECTOR } from '#cli/constants/generation.ts';
import type { Policy, FormatSettings } from '#cli/types/policy/policy.ts';
import { literalGlob, rebaseOverrides } from '#cli/generation/formatting/selectors.ts';

import type {
    ScopeFormat,
    FormatOverride,
    NativeOverride,
    PrettierPlugin,
    EditorconfigOverride,
} from '#cli/types/generation.ts';

function formatEntries(policy: Policy): ScopeFormat[] {
    const tables = [
        { scope: '', format: policy.format },
        ...Object.entries(policy.scopeTables).map(([scope, table]) => ({ scope, format: table.format ?? {} })),
    ].toSorted((first, second) => first.scope.split('/').length - second.scope.split('/').length);
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
): { plugins?: string[] } {
    if (plugins.length === 0) return {};
    const base = prefix === '' ? '.' : prefix;
    const shipped = plugins.map((plugin) => `${base}/${NODE_MODULES_DIRECTORY}/${plugin.name}/${plugin.entry}`);
    return { plugins: [...((extras['plugins'] as string[] | undefined) ?? []), ...shipped] };
}

// A Prettier selector as an EditorConfig section path, placed under its scope when it has one.
function editorconfigSelector(pattern: string, scope: string): string {
    if (pattern.startsWith('!') || UNREPRESENTABLE_SELECTOR.test(pattern))
        throw new Error(
            `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in tools.prettier.extra.overrides or a native EditorConfig section.`,
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Builds a template; inlining it nests a template inside a template.
export function prettierOptions(format: Partial<FormatSettings>): Record<string, unknown> {
    return {
        ...(format.indent_width === undefined ? {} : { tabWidth: format.indent_width }),
        ...(format.indent_style === undefined ? {} : { useTabs: format.indent_style === 'tab' }),
        ...(format.print_width === undefined ? {} : { printWidth: format.print_width }),
        ...(format.quotes === undefined ? {} : { singleQuote: format.quotes === 'single' }),
        ...(format.trailing_comma === undefined ? {} : { trailingComma: format.trailing_comma }),
        ...(format.semicolons === undefined ? {} : { semi: format.semicolons }),
        ...(format.line_ending === undefined ? {} : { endOfLine: format.line_ending }),
    };
}

/**
 * Generate each Prettier configuration relative to its own output path.
 * @param policy the repository policy
 * @param targetPath the path of the generated file
 * @param extra the authored Prettier settings the policy carries
 * @param plugins the Prettier plugins the selected manifests ship
 * @returns the Prettier configuration
 */
export function prettierConfiguration(
    policy: Policy,
    targetPath: string,
    extra: Record<string, unknown> | undefined,
    plugins: PrettierPlugin[],
): Record<string, unknown> {
    const prefix = relative(dirname(targetPath), '.').replaceAll('\\', '/');
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Builds a template; inlining it nests a template inside a template.
    const fromConfig = (pattern: string): string => (prefix === '' ? pattern : `${prefix}/${pattern}`);
    // The reason documents the policy override; it is not a Prettier option.
    const { overrides: nativeOverrides = [], ...extras } = extra ?? {};
    delete extras['reason'];
    const overrides = [
        ...plugins.flatMap((plugin) => plugin.overrides),
        ...policyOverrides(policy, fromConfig),
        ...rebaseOverrides(nativeOverrides as NativeOverride<Record<string, unknown>>[], '', prefix),
    ];
    const nativeDefaults = policy.tools['prettier']?.['native_defaults'] === true;
    const format = { ...(nativeDefaults ? {} : shippedFormat()), ...policy.format };
    return {
        ...prettierOptions(format),
        ...(nativeDefaults ? {} : { arrowParens: 'always', embeddedLanguageFormatting: 'off' }),
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
            ...(format.newline_at_end === undefined ? {} : { insert_final_newline: format.newline_at_end }),
        };
        if (Object.keys(options).length === 0) return [];
        return expandedPaths(paths).map((pattern) => ({ path: `/${editorconfigSelector(pattern, scope)}`, options }));
    });
}
