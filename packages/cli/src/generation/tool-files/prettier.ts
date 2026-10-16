import { dirname, relative } from 'node:path';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/config/system/locations.ts';
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

// A selector list as written: one string or several.
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
 * @param settings the repository settings and per-scope formatting overrides.
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
    prefix: string,
    extras: Record<string, unknown>,
): PrettierPluginOptions {
    if (plugins.length === 0) return {};
    const base = prefix === '' ? '.' : prefix;
    const shipped = plugins.map((plugin) => `${base}/${NODE_MODULES_DIRECTORY}/${plugin.name}/${plugin.entry}`);
    return { plugins: [...((extras['plugins'] as string[] | undefined) ?? []), ...shipped] };
}

/**
 * The Prettier options for the format settings a settings states.
 *
 * @param format the format settings, each optional.
 *
 * @returns the options Prettier reads, only for the settings given.
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
 * Generate each Prettier configuration relative to its own output path.
 *
 * @param input effective formatting, your own overrides, applicable plugins, and the output path.
 *
 * @returns the Prettier configuration.
 */
export function buildPrettierOptions(input: PrettierInput): Record<string, unknown> {
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
        ...buildPluginsOption(plugins, prefix, extras),
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}
export { listScopeFormats };
