import { dirname, relative } from 'node:path';
import { toPosix } from '#cli/system/paths.ts';
import { compact, isRecord } from '#cli/objects.ts';
import { everyTable } from '#cli/settings/inherit.ts';
import { byScopeDepth } from '#cli/repository/scopes.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/config/system/locations.ts';
import type { Manifest, ToolDeclaration } from '#cli/types/configurations.ts';
import type { WrittenFormat, FormatSettings } from '#cli/types/settings/file.ts';
import { literalGlob, includeFolderContents } from '#cli/repository/selectors.ts';
import type { Settings, ScopeView, ScopeSelection } from '#cli/types/settings/values.ts';

import {
    PRETTIER_TOOL,
    PRETTIERIGNORE_HEADER,
    PRETTIER_FIXED_OPTIONS,
    UNREPRESENTABLE_SELECTOR,
    EDITORCONFIG_FIXED_SECTIONS,
} from '#cli/config/generation/formatting.ts';
import type {
    ScopeFormat,
    ExtraOverride,
    PrettierInput,
    FormatOverride,
    PrettierPlugin,
    EditorconfigOverride,
    PrettierPluginOptions,
} from '#cli/types/generation/formatting.ts';

// A selector list as written: one string or several.
function asList(value: string | string[] | undefined): string[] {
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
}

// A negation keeps its mark in front of the moved selector.
function rebasePattern(pattern: string, fromConfig: (selector: string) => string): string {
    return pattern.startsWith('!') ? `!${fromConfig(pattern.slice(1))}` : fromConfig(pattern);
}

// Basename selectors stay relative to every folder; path selectors move from the root to the generated file.
function rebaseOverrides(
    entries: ExtraOverride<Record<string, unknown>>[],
    fromConfig: (pattern: string) => string,
): FormatOverride[] {
    return entries.flatMap((entry) => {
        const files = asList(entry.files);
        const excluded = asList(entry.excludeFiles);
        return [false, true].flatMap((hasSlash) => {
            const patterns = files.filter((pattern) => pattern.includes('/') === hasSlash);
            if (patterns.length === 0) return [];
            return [
                {
                    files: hasSlash ? patterns.map((pattern) => rebasePattern(pattern, fromConfig)) : patterns,
                    excludeFiles: hasSlash ? excluded.map((pattern) => rebasePattern(pattern, fromConfig)) : excluded,
                    options: entry.options,
                },
            ];
        });
    });
}

function formatEntries(settings: Settings): ScopeFormat[] {
    const tables = everyTable(settings)
        .toSorted((first, second) => byScopeDepth(first.scope ?? '', second.scope ?? ''))
        .flatMap(({ scope = '', table }) => {
            const authored = table.written['format'];
            if (table.format === undefined || !isRecord(authored)) return [];
            const format = Object.fromEntries(
                Object.entries(table.format).filter(([key]) => Object.hasOwn(authored, key)),
            ) as WrittenFormat;
            return [{ scope, format }];
        });
    const base = tables.flatMap(({ scope, format: { override: _overrides, ...format } }) =>
        scope === '' || Object.keys(format).length === 0 ? [] : [{ scope, paths: ['**/*'], format: compact(format) }],
    );
    const overrides = tables.flatMap(({ scope, format }) =>
        (format.override ?? []).map(({ paths, ...format }) => ({ scope, paths, format: compact(format) })),
    );
    return [...base, ...overrides];
}

// Format overrides for each project and path, relative to the generated file.
function formatSettingOverrides(settings: Settings, fromConfig: (pattern: string) => string): FormatOverride[] {
    return formatEntries(settings).map(({ scope, paths, format }) => {
        const expanded = includeFolderContents(paths);
        const files = expanded.filter((path) => !path.startsWith('!')).map((path) => fromConfig(path));
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => fromConfig(path.slice(1)));
        if (scope !== '') excludeFiles.push(`!${fromConfig(literalGlob(scope))}/**`);
        return { files, excludeFiles, options: prettierOptions(format) };
    });
}

// Prettier loads your plugins, then shipped plugins by paths relative to its tool file.
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
            `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in tools.prettier.extra.value.overrides or an EditorConfig section.`,
        );
    if (scope === '' || pattern.startsWith(`${scope}/`)) return pattern;
    if (!pattern.startsWith('**/') || pattern.slice('**/'.length).includes('/'))
        throw new Error(
            `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scope}. Use a root-relative selector within that scope.`,
        );
    return `${literalGlob(scope)}/${pattern}`;
}

/**
 * The Prettier options for the format settings a settings states.
 *
 * @param format the format settings, each optional.
 *
 * @returns the options Prettier reads, only for the settings given.
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
 *
 * @param input effective formatting, your own overrides, applicable plugins, and the output path.
 *
 * @returns the Prettier configuration.
 */
export function prettierConfiguration(input: PrettierInput): Record<string, unknown> {
    const { settings, format, targetPath, extra, plugins } = input;
    const prefix = toPosix(relative(dirname(targetPath), '.'));
    const fromConfig = (pattern: string): string => (prefix === '' ? pattern : `${prefix}/${pattern}`);
    const { overrides: extraOverrides = [], ...extras } = extra === undefined ? {} : extra;
    const overrides = [
        ...plugins.flatMap((plugin) => plugin.overrides),
        ...formatSettingOverrides(settings, fromConfig),
        ...rebaseOverrides(extraOverrides as ExtraOverride<Record<string, unknown>>[], fromConfig),
    ];
    return {
        ...prettierOptions(format),
        ...PRETTIER_FIXED_OPTIONS,
        ...extras,
        ...pluginEntries(plugins, prefix, extras),
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}

/**
 * EditorConfig sections for each project's format settings.
 *
 * @param settings the repository settings.
 *
 * @returns one override per selector with the settings EditorConfig can express.
 * @throws when EditorConfig cannot express a selector
 */
export function editorconfigOverrides(settings: Settings): EditorconfigOverride[] {
    return formatEntries(settings).flatMap(({ scope, paths, format }) => {
        const options = {
            ...(format.indent_style === undefined ? {} : { indent_style: format.indent_style }),
            ...(format.indent_width === undefined ? {} : { indent_size: format.indent_width }),
            ...(format.line_ending === undefined ? {} : { end_of_line: format.line_ending }),
            ...(format.final_newline === undefined ? {} : { insert_final_newline: format.final_newline }),
        };
        if (Object.keys(options).length === 0) return [];
        return includeFolderContents(paths).map((pattern) => ({
            path: `/${editorconfigSelector(pattern, scope)}`,
            options,
        }));
    });
}
/**
 * Write the editorconfig configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.format the resolved formatting settings.
 * @param root0.extra the authored additional tool options.
 * @param root0.editorconfigOverrides the authored EditorConfig section reader.
 *
 * @returns the generated configuration text.
 */
export function editorconfigToolFile({
    format,
    extra,
    editorconfigOverrides,
}: Pick<ScopeView, 'format' | 'extra'> & { editorconfigOverrides: () => EditorconfigOverride[] }): string {
    const native = extra('editorconfig-checker');
    const sections = [
        {
            path: '*',
            options: {
                ...EDITORCONFIG_FIXED_SECTIONS['*'],
                end_of_line: format.line_ending,
                insert_final_newline: format.final_newline,
                indent_style: format.indent_style,
                indent_size: format.indent_width,
            },
        },
        { path: '*.md', options: EDITORCONFIG_FIXED_SECTIONS['*.md'] },
        { path: 'Makefile', options: EDITORCONFIG_FIXED_SECTIONS.Makefile },
        ...(native === undefined ? [] : Object.entries(native)).flatMap(([path, options]) =>
            typeof options === 'object' && options !== null ? [{ path, options }] : [],
        ),
        ...editorconfigOverrides(),
    ];
    return (
        'root = true\n\n' +
        sections
            .map(
                ({ path, options }) =>
                    `[${path}]\n` +
                    Object.entries(options)
                        .map(([key, value]) => `${key} = ${String(value)}`)
                        .join('\n'),
            )
            .join('\n\n') +
        '\n'
    );
}

/**
 * Write the prettierignore configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.ignoresFor the check path-ignore reader.
 * @param root0.ignoredPaths the generated ignore path patterns.
 *
 * @returns the generated configuration text.
 */
export function prettierignoreToolFile({
    ignoresFor,
    ignoredPaths,
}: Pick<ScopeView, 'ignoresFor'> & { ignoredPaths: string[] }): string {
    return (
        [
            PRETTIERIGNORE_HEADER,
            ...ignoredPaths,
            ...ignoresFor('format/prettier')
                .filter(({ rule }) => rule === undefined)
                .flatMap(({ paths }) => paths),
        ].join('\n') + '\n'
    );
}

/**
 * Resolve the selected formatter plugins once. Retain their declaration identities and npm entries.
 *
 * @param manifests the selected configuration manifests.
 *
 * @returns the selected formatter plugins and their module paths.
 */
export function prettierPlugins(manifests: Iterable<Manifest>): Map<ToolDeclaration, PrettierPlugin> {
    return new Map(
        [...manifests].flatMap(({ tools }) =>
            tools.flatMap((tool): [ToolDeclaration, PrettierPlugin][] => {
                const name = tool.installers['npm']?.name;
                return tool.prettier === undefined || name === undefined
                    ? []
                    : [[tool, { name, entry: tool.prettier.entry, overrides: tool.prettier.overrides }]];
            }),
        ),
    );
}

/**
 * The selected plugin tools that active formatter checks require.
 *
 * @param scopes the selected project scopes.
 * @param programs the declared program installations.
 *
 * @returns the package names required by active formatter plugins.
 */
export function prettierToolRequirements(scopes: ScopeSelection[], programs: ReadonlySet<string>): string[] {
    return programs.has(PRETTIER_TOOL)
        ? [...prettierPlugins(scopes.flatMap(({ selected }) => selected)).keys()].map(({ name }) => name)
        : [];
}
