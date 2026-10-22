import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { DEFAULT_QUOTES } from '#cli/config/settings/defaults.ts';
import { listPrettierPlugins } from '#cli/planning/needed-tools.ts';
import { includeFolderContents } from '#cli/repository/matchers.ts';
import { GSPOT_NODE_MODULES_PATH } from '#cli/config/gspot-paths.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import type { Settings, WrittenFormat, FormatSettings } from '#cli/types/settings/file.ts';
import { PRETTIER_FIXED_OPTIONS } from '#cli/config/generation/settings/builders/prettier.ts';
import type { ScopeFormat, FormatOverride, PrettierPlugin } from '#cli/types/generation/formatting.ts';

/**
 * Collect the root and nested formatting settings with their selectors.
 *
 * @param settings the parsed gspot.toml.
 * @returns the root and nested formatting overrides with their file selectors.
 */
export function listScopeFormats(settings: Settings): ScopeFormat[] {
    const tables = listSettingsTables(settings)
        .toSorted((first, second) => compareScopeDepth(first.scope ?? '', second.scope ?? ''))
        .flatMap(({ scope = '', table }) => {
            const authored = table.written['format'];
            if (table.format === undefined || !isTable(authored)) return [];
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
function listFormatOverrides(settings: Settings): FormatOverride[] {
    return listScopeFormats(settings).map(({ scope, paths, format }) => {
        const expanded = includeFolderContents(paths);
        const files = expanded.filter((path) => !path.startsWith('!'));
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => path.slice(1));
        if (scope !== '') excludeFiles.push(`!${scope.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH)}/**`);
        return { files, excludeFiles, options: convertFormatSettings(format) };
    });
}

// Prettier loads shipped plugins by paths relative to the root pointer.
function buildPluginsOption(plugins: PrettierPlugin[]): { plugins?: string[] } {
    if (plugins.length === 0) return {};
    const shipped = plugins.map((plugin) => `./${GSPOT_NODE_MODULES_PATH}/${plugin.name}/${plugin.entry}`);
    return { plugins: shipped };
}

/**
 * Convert format settings to Prettier options.
 *
 * @param format the format settings, each optional.
 * @returns the Prettier options for each format setting that has a value.
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
 * Build prettier.json, which the root pointer loads: the formatter options, plugins, and scope overrides.
 *
 * @param planned the tool file with its scope, level, and target path.
 * @returns the formatter options, plugins, and scope overrides.
 */
export function buildPrettierFile(planned: PlannedToolFile): string {
    const settings = planned.session.settingsFile.settings;
    const format = planned.scope.settings.values.format;
    const plugins = [
        ...listPrettierPlugins(planned.session.scopes.flatMap(({ configurations }) => configurations)).values(),
    ];
    const overrides = [...plugins.flatMap((plugin) => plugin.overrides), ...listFormatOverrides(settings)];
    const value = {
        ...convertFormatSettings({ ...format, quotes: format.quotes ?? DEFAULT_QUOTES.prettier }),
        ...PRETTIER_FIXED_OPTIONS,
        ...buildPluginsOption(plugins),
        ...(overrides.length === 0 ? {} : { overrides }),
    };
    return JSON.stringify(value, null, JSON_INDENT);
}
