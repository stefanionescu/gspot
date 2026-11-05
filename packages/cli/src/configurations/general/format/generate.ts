import {
    DEFAULT_QUOTES,
    EDITORCONFIG_FIXED_SECTIONS,
    EDITORCONFIG_ROOT_LINE,
    PRETTIER_CHECK,
    PRETTIER_MARKDOWN_OVERRIDE,
    UNREPRESENTABLE_SELECTOR,
} from '#cli/config/configurations/general.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { keepFirstPatterns, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import { listPrettierPlugins } from '#cli/engine/tools.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import { includeFolderContents } from '#cli/system/matchers.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { isTable } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import {
    type ConfigBuilder,
    type FormatOverride,
    type ScopeFormat,
    type WrittenFormat,
} from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import type { PrettierPlugin } from '#cli/types/engine/plan.ts';
import type { Settings } from '#cli/types/settings.ts';

const SHFMT_CONFIGURATION = 'bash';

// shfmt reads these keys, and no other tool does. They sit under [*] because shell scripts may have no extension.
const SHFMT_EDITORCONFIG_OPTIONS = { switch_case_indent: true, simplify: true } as const;

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
    for (const { scopePath = '', table } of orderedTables) {
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

function listFormatOverrides(settings: Settings): FormatOverride[] {
    return listScopeFormats(settings).map(({ scopePath, paths, format }) => {
        const included = includeFolderContents(paths);
        const files = included.filter((path) => !path.startsWith('!'));
        const excludeFiles = included.filter((path) => path.startsWith('!')).map((path) => path.slice(1));
        if (scopePath !== '') excludeFiles.push(`!${escapeGlob(scopePath)}/**`);
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
                bracketSpacing: format.bracket_spacing,
                arrowParens: format.arrow_parens,
                proseWrap: format.prose_wrap,
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
Build .editorconfig: the EditorConfig sections of this repository, and the shfmt layout when a scope selects Bash.

@param planned the config file to build.
*/
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

/**
Build prettier.json, which the root pointer file loads: the formatter options, plugins, and scope overrides.

@param planned the config file to build.
*/
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
        tabWidth: format.indent_width,
        useTabs: format.indent_style === 'tab',
        printWidth: format.print_width,
        singleQuote: (format.quotes ?? DEFAULT_QUOTES.prettier) === 'single',
        trailingComma: format.trailing_commas,
        semi: format.semicolons,
        bracketSpacing: format.bracket_spacing,
        arrowParens: format.arrow_parens,
        proseWrap: format.prose_wrap,
        ...buildPluginsOption(plugins),
        overrides,
    };
    return JSON.stringify(value, null, JSON_INDENT);
}

/**
Build .prettierignore: the ignored paths in the shared section order, with the written reasons.

@param planned the config file to build.
*/
function buildPrettierignoreFile(planned: PlannedConfig): string {
    const ordered = [...planned.ignoreSections, ...listCheckIgnoreSections(planned.scope.settings, PRETTIER_CHECK)].map(
        (section) => ({
            ...section,
            patterns: [
                ...section.patterns.filter((pattern) => !pattern.startsWith('!')).toSorted(compareText),
                ...section.patterns.filter((pattern) => pattern.startsWith('!')).toSorted(compareText),
            ],
        }),
    );
    const lines = keepFirstPatterns(ordered).flatMap(({ title, patterns }) =>
        patterns.length === 0
            ? []
            : [
                  '',
                  ...title
                      .replaceAll('\r\n', '\n')
                      .replaceAll('\r', '\n')
                      .split('\n')
                      .map((line) => `# ${line}`),
                  ...patterns,
              ],
    );
    return [...lines, ''].join('\n').trimStart();
}

export const FORMAT_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'format/.prettierignore': buildPrettierignoreFile,
    'format/.editorconfig': buildEditorconfigFile,
    'format/prettier.json': buildPrettierFile,
};
