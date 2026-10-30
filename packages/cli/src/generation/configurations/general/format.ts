import { isTable } from '#cli/system/tables.ts';
import { JSON_INDENT } from '#cli/config/text.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listPrettierPlugins } from '#cli/planning/tools.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { includeFolderContents } from '#cli/system/matchers.ts';
import { type PlannedConfigFile } from '#cli/types/generation/files.ts';
import { type Settings, type WrittenFormat } from '#cli/types/settings/file.ts';
import { type ScopeFormat, type FormatOverride, type PrettierPlugin } from '#cli/types/generation/formatting.ts';

import {
    DEFAULT_QUOTES,
    EDITORCONFIG_ROOT_LINE,
    PRETTIER_FIXED_OPTIONS,
    UNREPRESENTABLE_SELECTOR,
    EDITORCONFIG_FIXED_SECTIONS,
} from '#cli/config/generation/configurations/general/format.ts';

function buildSectionPath(pattern: string, scopePath: string): string {
    if (pattern.startsWith('!') || UNREPRESENTABLE_SELECTOR.test(pattern))
        throw new GspotError(
            'settings',
            `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in a \`[[format.override]]\` record with a selector that EditorConfig can read.`,
        );
    if (scopePath === '' || pattern.startsWith(`${scopePath}/`)) return pattern;
    if (!pattern.startsWith('**/') || pattern.slice('**/'.length).includes('/'))
        throw new GspotError(
            'settings',
            `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scopePath}. Use a root-relative selector within that scope.`,
        );
    return `${escapeGlob(scopePath)}/${pattern}`;
}

/**
Build .editorconfig: the EditorConfig sections of this repository.

@param planned the config file to build.
*/
export function buildEditorconfigFile(planned: PlannedConfigFile): string {
    const { format } = planned.scope.settings.tables;
    const settings = planned.session.settings;

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
        ...Object.entries(EDITORCONFIG_FIXED_SECTIONS)
            .filter(([path]) => path !== '*')
            .map(([path, options]) => ({ path, options })),
        ...listScopeFormats(settings).flatMap(({ scope, paths, format }) => {
            const options = {
                ...(format.indent_style !== undefined && { indent_style: format.indent_style }),
                ...(format.indent_width !== undefined && { indent_size: format.indent_width }),
                ...(format.line_ending !== undefined && { end_of_line: format.line_ending }),
                ...(format.final_newline !== undefined && { insert_final_newline: format.final_newline }),
            };
            if (Object.keys(options).length === 0) return [];
            return includeFolderContents(paths).map((pattern) => ({
                path: `/${buildSectionPath(pattern, scope)}`,
                options,
            }));
        }),
    ];
    return (
        EDITORCONFIG_ROOT_LINE +
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

function listScopeFormats(settings: Settings): ScopeFormat[] {
    const orderedTables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scope, second.scope),
    );
    const tables: { scope: string; format: WrittenFormat }[] = [];
    for (const { scope = '', table } of orderedTables) {
        const authored = table.written['format'];
        if (table.format === undefined || !isTable(authored)) continue;
        const format = Object.fromEntries(
            Object.entries(table.format).filter(([key]) => Object.hasOwn(authored, key)),
        ) as WrittenFormat;
        tables.push({ scope, format });
    }
    const base = tables.flatMap(({ scope, format: { override: _overrides, ...format } }) =>
        scope === '' || Object.keys(format).length === 0 ? [] : { scope, paths: ['**/*'], format },
    );
    const overrides = tables.flatMap(({ scope, format }) =>
        (format.override ?? []).map(({ paths, ...format }) => ({ scope, paths, format })),
    );
    return [...base, ...overrides];
}

function listFormatOverrides(settings: Settings): FormatOverride[] {
    return listScopeFormats(settings).map(({ scope, paths, format }) => {
        const included = includeFolderContents(paths);
        const files = included.filter((path) => !path.startsWith('!'));
        const excludeFiles = included.filter((path) => path.startsWith('!')).map((path) => path.slice(1));
        if (scope !== '') excludeFiles.push(`!${escapeGlob(scope)}/**`);
        return {
            files,
            excludeFiles,
            options: {
                tabWidth: format.indent_width,
                useTabs: format.indent_style === undefined ? undefined : format.indent_style === 'tab',
                printWidth: format.print_width,
                singleQuote: format.quotes === undefined ? undefined : format.quotes === 'single',
                trailingComma: format.trailing_commas,
                semi: format.semicolons,
                endOfLine: format.line_ending,
            },
        };
    });
}

function buildPluginsOption(plugins: PrettierPlugin[]): { plugins?: string[] } {
    if (plugins.length === 0) return {};
    const shipped = plugins.map((plugin) => `./${GSPOT_PATHS.nodeModules}/${plugin.name}/${plugin.module}`);
    return { plugins: shipped };
}

/**
Build prettier.json, which the root link file loads: the formatter options, plugins, and scope overrides.

@param planned the config file to build.
*/
export function buildPrettierFile(planned: PlannedConfigFile): string {
    const settings = planned.session.settings;
    const format = planned.scope.settings.tables.format;
    const plugins = listPrettierPlugins(planned.session.scopes.flatMap(({ configurations }) => configurations))
        .values()
        .toArray();
    const overrides = [...plugins.flatMap((plugin) => plugin.overrides), ...listFormatOverrides(settings)];
    const value = {
        tabWidth: format.indent_width,
        useTabs: format.indent_style === 'tab',
        printWidth: format.print_width,
        singleQuote: (format.quotes ?? DEFAULT_QUOTES.prettier) === 'single',
        trailingComma: format.trailing_commas,
        semi: format.semicolons,
        endOfLine: format.line_ending,
        ...PRETTIER_FIXED_OPTIONS,
        ...buildPluginsOption(plugins),
        ...(overrides.length > 0 && { overrides }),
    };
    return JSON.stringify(value, null, JSON_INDENT);
}
