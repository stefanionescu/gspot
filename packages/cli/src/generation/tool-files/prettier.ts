import { dirname, relative } from 'node:path';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { listPrettierPlugins } from '#cli/planning/needed-tools.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { GSPOT_NODE_MODULES_PATH } from '#cli/config/system/locations.ts';
import { PRETTIER_FIXED_OPTIONS } from '#cli/config/generation/formatting.ts';
import { escapeGlob, includeFolderContents } from '#cli/repository/matchers.ts';
import type { WrittenFormat, FormatSettings } from '#cli/types/settings/file.ts';

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

// A negation keeps its mark in front of the moved selector.
function movePattern(pattern: string, moveFromRoot: (selector: string) => string): string {
    return pattern.startsWith('!') ? `!${moveFromRoot(pattern.slice(1))}` : moveFromRoot(pattern);
}

// Basename selectors stay relative to every folder; path selectors move from the root to the generated file.
function moveOverrides(
    entries: ExtraOverride<Record<string, unknown>>[],
    moveFromRoot: (pattern: string) => string,
): FormatOverride[] {
    return entries.flatMap((entry) => {
        const files = normalizeSelectors(entry.files);
        const excluded = normalizeSelectors(entry.excludeFiles);
        return [false, true].flatMap((hasSlash) => {
            const patterns = files.filter((pattern) => pattern.includes('/') === hasSlash);
            if (patterns.length === 0) return [];
            return [
                {
                    files: hasSlash ? patterns.map((pattern) => movePattern(pattern, moveFromRoot)) : patterns,
                    excludeFiles: hasSlash ? excluded.map((pattern) => movePattern(pattern, moveFromRoot)) : excluded,
                    options: entry.options,
                },
            ];
        });
    });
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

// Format overrides for each project and path, relative to the generated file.
function formatSettingOverrides(settings: Settings, moveFromRoot: (pattern: string) => string): FormatOverride[] {
    return listScopeFormats(settings).map(({ scope, paths, format }) => {
        const expanded = includeFolderContents(paths);
        const files = expanded.filter((path) => !path.startsWith('!')).map((path) => moveFromRoot(path));
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => moveFromRoot(path.slice(1)));
        if (scope !== '') excludeFiles.push(`!${moveFromRoot(escapeGlob(scope))}/**`);
        return { files, excludeFiles, options: convertFormatSettings(format) };
    });
}

// Prettier loads your plugins, then shipped plugins by paths relative to its tool file.
function buildPluginsOption(
    plugins: PrettierPlugin[],
    targetPath: string,
    extras: Record<string, unknown>,
): PrettierPluginOptions {
    if (plugins.length === 0) return {};
    const base = convertToPosixPath(relative(dirname(targetPath), GSPOT_NODE_MODULES_PATH));
    const shipped = plugins.map(
        (plugin) =>
            `${base.startsWith('./') || base.startsWith('../') ? base : './' + base}/${plugin.name}/${plugin.entry}`,
    );
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
 * Generate the Prettier options relative to the path of the tool file.
 *
 * @param input what the Prettier file holds.
 *
 * @returns the Prettier options.
 */
function buildPrettierOptions(input: PrettierInput): Record<string, unknown> {
    const { settings, format, targetPath, extra, plugins } = input;
    const prefix = convertToPosixPath(relative(dirname(targetPath), '.'));
    const moveFromRoot = (pattern: string): string => (prefix === '' ? pattern : `${prefix}/${pattern}`);
    const { overrides: extraOverrides = [], ...extras } = extra === undefined ? {} : extra;
    const overrides = [
        ...plugins.flatMap((plugin) => plugin.overrides),
        ...formatSettingOverrides(settings, moveFromRoot),
        ...moveOverrides(extraOverrides as ExtraOverride<Record<string, unknown>>[], moveFromRoot),
    ];
    return {
        ...convertFormatSettings(format),
        ...PRETTIER_FIXED_OPTIONS,
        ...extras,
        ...buildPluginsOption(plugins, targetPath, extras),
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}

/**
 * Build the Prettier tool file relative to its destination.
 * @param context the tool file to build.
 * @returns the formatter options, plugins, and scope overrides.
 */
function buildPrettierFile(context: ToolFileContext): string {
    const value = buildPrettierOptions({
        settings: context.session.settingsFile.settings,
        format: context.selection.view.format,
        extra: context.selection.view.extra('prettier'),
        plugins: [...listPrettierPlugins(context.scopes.flatMap(({ selected }) => selected)).values()],
        targetPath: context.targetPath,
    });
    return JSON.stringify(value, null, JSON_INDENT) + '\n';
}

export { listScopeFormats, buildPrettierFile };
