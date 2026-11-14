import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { Settings } from '#cli/types/settings.ts';
import { compareText } from '#cli/system/text/order.ts';
import { JSON_INDENT } from '#cli/config/tools/programs.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listPrettierPlugins } from '#cli/engine/plan/tools.ts';
import type { PrettierPlugin } from '#cli/types/engine/plan.ts';
import { joinScopeSelector } from '#cli/settings/values/paths.ts';
import { listSettingsTables } from '#cli/settings/values/written.ts';
import { DEFAULT_QUOTES } from '#cli/config/configurations/shared.ts';
import { escapeGlob, includeFolderContents } from '#cli/system/patterns.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';
import type { ScopeFormat, WrittenFormat, FormatOverride } from '#cli/types/configurations/general.ts';
import { keepFirstPatterns, commentSectionTitle, listPlannedIgnoreSections } from '#cli/configurations/ignores.ts';

import {
    PRETTIER_CHECK,
    SHFMT_CONFIGURATION,
    EDITORCONFIG_ROOT_LINE,
    UNREPRESENTABLE_SELECTOR,
    PRETTIER_MARKDOWN_OVERRIDE,
    SHFMT_EDITORCONFIG_OPTIONS,
    EDITORCONFIG_FIXED_SECTIONS,
} from '#cli/config/configurations/general.ts';

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

function listScopeFormats(settings: Settings): ScopeFormat[] {
    const orderedTables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scopePath, second.scopePath),
    );
    const tables: Array<{ scopePath: string; format: WrittenFormat }> = [];
    for (const { scopePath, table } of orderedTables) {
        const authored = table.written['format'];
        if (table.format === undefined || !isTable(authored)) continue;
        const format = Object.fromEntries(
            Object.entries(table.format).filter(([key]) => Object.hasOwn(authored, key)),
        ) as WrittenFormat;
        tables.push({ scopePath, format });
    }
    const base = tables.flatMap(({ scopePath, format: { override: _overrides, ...format } }) =>
        scopePath === '' || Object.keys(format).length === 0 ? [] : { scopePath, paths: ['**/*'], format },
    );
    const overrides = tables.flatMap(({ scopePath, format }) =>
        (format.override ?? []).map(({ paths, ...format }) => ({
            scopePath,
            paths: paths.map((path) => joinScopeSelector(path, scopePath)),
            format,
        })),
    );
    return [...base, ...overrides];
}

function buildPrettierOptions(format: ScopeFormat['format']): Record<string, unknown> {
    return {
        tabWidth: format.indent_width,
        useTabs: format.indent_style === undefined ? undefined : format.indent_style === 'tab',
        printWidth: format.print_width,
        singleQuote: format.quotes === undefined ? undefined : format.quotes === 'single',
        trailingComma: format.trailing_commas,
        semi: format.semicolons,
        bracketSpacing: format.bracket_spacing,
        arrowParens: format.arrow_parens,
        proseWrap: format.prose_wrap,
    };
}

function listFormatOverrides(settings: Settings): FormatOverride[] {
    return listScopeFormats(settings).map(({ scopePath, paths, format }) => {
        const included = includeFolderContents(paths);
        const files = included.filter((path) => !path.startsWith('!'));
        const excludeFiles = included.filter((path) => path.startsWith('!')).map((path) => path.slice(1));
        if (scopePath !== '') excludeFiles.push(`!${escapeGlob(scopePath)}/**`);
        return { files, excludeFiles, options: buildPrettierOptions(format) };
    });
}

function buildPluginsOption(plugins: PrettierPlugin[]): { plugins?: string[] } {
    if (plugins.length === 0) return {};
    const shipped = plugins.map((plugin) => `./${GSPOT_PATHS.nodeModules}/${plugin.name}/${plugin.module}`);
    return { plugins: shipped };
}

function buildEditorconfigFile(planned: PlannedConfig): string {
    const { format } = planned.scope.settings.tables;
    const settings = planned.session.settings;
    const hasBash = planned.session.scopes.some(({ configurations }) =>
        configurations.some(({ name }) => name === SHFMT_CONFIGURATION),
    );
    const sections = [
        {
            path: '*',
            options: {
                ...EDITORCONFIG_FIXED_SECTIONS['*'],
                indent_style: format.indent_style,
                indent_size: format.indent_width,
                ...(hasBash && SHFMT_EDITORCONFIG_OPTIONS),
            },
        },
        ...Object.entries(EDITORCONFIG_FIXED_SECTIONS)
            .filter(([path]) => path !== '*')
            .map(([path, options]) => ({ path, options })),
        ...listScopeFormats(settings).flatMap(({ scopePath, paths, format }) => {
            const options = {
                ...(format.indent_style !== undefined && { indent_style: format.indent_style }),
                ...(format.indent_width !== undefined && { indent_size: format.indent_width }),
            };
            if (Object.keys(options).length === 0) return [];
            return includeFolderContents(paths).map((pattern) => ({
                path: `/${buildSectionPath(pattern, scopePath)}`,
                options,
            }));
        }),
    ];
    return `${
        EDITORCONFIG_ROOT_LINE +
        sections
            .map(
                ({ path, options }) =>
                    `[${path}]\n${Object.entries(options)
                        .map(([key, value]) => `${key} = ${String(value)}`)
                        .join('\n')}`,
            )
            .join('\n\n')
    }\n`;
}

function buildPrettierFile(planned: PlannedConfig): string {
    const settings = planned.session.settings;
    const format = planned.scope.settings.tables.format;
    const plugins = listPrettierPlugins(planned.session.scopes.flatMap(({ configurations }) => configurations))
        .values()
        .toArray();
    const overrides = [
        PRETTIER_MARKDOWN_OVERRIDE,
        ...plugins.flatMap((plugin) => plugin.overrides),
        ...listFormatOverrides(settings),
    ];
    const value = {
        ...buildPrettierOptions({ ...format, quotes: format.quotes ?? DEFAULT_QUOTES.prettier }),
        ...buildPluginsOption(plugins),
        overrides,
    };
    return JSON.stringify(value, null, JSON_INDENT);
}

function buildPrettierignoreFile(planned: PlannedConfig): string {
    const ordered = listPlannedIgnoreSections(planned, PRETTIER_CHECK).map((section) => ({
        ...section,
        patterns: [
            ...section.patterns.filter((pattern) => !pattern.startsWith('!')).toSorted(compareText),
            ...section.patterns.filter((pattern) => pattern.startsWith('!')).toSorted(compareText),
        ],
    }));
    const lines = keepFirstPatterns(ordered).flatMap(({ title, patterns }) =>
        patterns.length === 0 ? [] : ['', ...commentSectionTitle(title, ''), ...patterns],
    );
    return [...lines, ''].join('\n').trimStart();
}

export const FORMAT_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'format/.prettierignore': buildPrettierignoreFile,
    'format/.editorconfig': buildEditorconfigFile,
    'format/prettier.json': buildPrettierFile,
};
