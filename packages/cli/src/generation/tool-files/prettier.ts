import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { listPrettierPlugins } from '#cli/planning/needed-tools.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { GSPOT_NODE_MODULES_PATH } from '#cli/config/system/locations.ts';
import { escapeGlob, includeFolderContents } from '#cli/repository/matchers.ts';
import type { WrittenFormat, FormatSettings } from '#cli/types/settings/file.ts';
import { DEFAULT_QUOTES, PRETTIER_FIXED_OPTIONS } from '#cli/config/generation/formatting.ts';

import type {
    ScopeFormat,
    ExtraOverride,
    PrettierInput,
    FormatOverride,
    PrettierPlugin,
    PrettierPluginOptions,
} from '#cli/types/generation/formatting.ts';

// Read a selector list as written: one string or several.
function normalizeSelectors(value: string | string[] | undefined): string[] {
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
}

// Read each override as Prettier takes it: lists of selectors relative to the root.
function normalizeOverrides(entries: ExtraOverride<Record<string, unknown>>[]): FormatOverride[] {
    return entries.map((entry) => ({
        files: normalizeSelectors(entry.files),
        excludeFiles: normalizeSelectors(entry.excludeFiles),
        options: entry.options,
    }));
}

/**
 * Collect the root and nested formatting settings with their selectors.
 * @param settings the parsed gspot.toml.
 * @returns the root and nested formatting overrides with their file selectors.
 */
function listScopeFormats(settings: Settings): ScopeFormat[] {
    const tables = listSettingsTables(settings)
        .toSorted((first, second) => compareScopeDepth(first.scope ?? '', second.scope ?? ''))
        .flatMap(({ scope = '', table }) => {
            const authored = table.written['format'];
            if (table.format === undefined || !isRecord(authored)) return [];
            const format = Object.fromEntries(
                Object.entries(table.format).filter(([key]) => Object.hasOwn(authored, key)),
            ) as WrittenFormat;
            return [{ scope, format }];
        });
    const base = tables.flatMap(({ scope, format: { override: _overrides, ...format } }) =>
        scope === '' || Object.keys(format).length === 0
            ? []
            : [{ scope, paths: ['**/*'], format: stripUndefined(format) }],
    );
    const overrides = tables.flatMap(({ scope, format }) =>
        (format.override ?? []).map(({ paths, ...format }) => ({ scope, paths, format: stripUndefined(format) })),
    );
    return [...base, ...overrides];
}

// Format overrides for each project and path, relative to the root.
function formatSettingOverrides(settings: Settings): FormatOverride[] {
    return listScopeFormats(settings).map(({ scope, paths, format }) => {
        const expanded = includeFolderContents(paths);
        const files = expanded.filter((path) => !path.startsWith('!'));
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => path.slice(1));
        if (scope !== '') excludeFiles.push(`!${escapeGlob(scope)}/**`);
        return { files, excludeFiles, options: convertFormatSettings(format) };
    });
}

// Prettier loads your plugins, then shipped plugins by paths relative to the root pointer.
function buildPluginsOption(plugins: PrettierPlugin[], extras: Record<string, unknown>): PrettierPluginOptions {
    if (plugins.length === 0) return {};
    const shipped = plugins.map((plugin) => `./${GSPOT_NODE_MODULES_PATH}/${plugin.name}/${plugin.entry}`);
    return { plugins: [...((extras['plugins'] as string[] | undefined) ?? []), ...shipped] };
}

/**
 * Convert format settings to Prettier options.
 *
 * @param format width, indent, and line ending, each optional.
 *
 * @returns the Prettier options for each setting in the input.
 */
function convertFormatSettings(format: Partial<FormatSettings>): Record<string, unknown> {
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
 * Generate the Prettier options. Paths start at the root, where the pointer that loads them sits.
 *
 * @param input what the Prettier file holds.
 *
 * @returns the settings to write as JSON.
 */
function buildPrettierOptions(input: PrettierInput): Record<string, unknown> {
    const { settings, format, extra, plugins } = input;
    const { overrides: extraOverrides = [], ...extras } = extra === undefined ? {} : extra;
    const overrides = [
        ...plugins.flatMap((plugin) => plugin.overrides),
        ...formatSettingOverrides(settings),
        ...normalizeOverrides(extraOverrides as ExtraOverride<Record<string, unknown>>[]),
    ];
    return {
        ...convertFormatSettings({ ...format, quotes: format.quotes ?? DEFAULT_QUOTES.prettier }),
        ...PRETTIER_FIXED_OPTIONS,
        ...extras,
        ...buildPluginsOption(plugins, extras),
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}

/**
 * Build the Prettier tool file that the root pointer loads.
 * @param context the tool file to build.
 * @returns the formatter options, plugins, and scope overrides.
 */
function buildPrettierFile(context: ToolFileContext): string {
    const value = buildPrettierOptions({
        settings: context.session.settingsFile.settings,
        format: context.selection.view.format,
        extra: context.selection.view.extra('prettier'),
        plugins: [...listPrettierPlugins(context.session.scopes.flatMap(({ selected }) => selected)).values()],
    });
    return JSON.stringify(value, null, JSON_INDENT) + '\n';
}

export { listScopeFormats, buildPrettierFile };
