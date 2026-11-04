import { isTable } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { Settings } from '#cli/types/settings.ts';
import { listPrettierPlugins } from '#cli/engine/tools.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { includeFolderContents } from '#cli/system/matchers.ts';
import type { PrettierPlugin } from '#cli/types/engine/plan.ts';
import { escapeGlob, extractExtension } from '#cli/system/paths.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { keepFirstPatterns, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';

import {
    type ScopeFormat,
    type ConfigBuilder,
    type WrittenFormat,
    type FormatOverride,
} from '#cli/types/configurations/general.ts';
import {
    PRETTIER_CHECK,
    DEFAULT_QUOTES,
    EDITORCONFIG_ROOT_LINE,
    UNREPRESENTABLE_SELECTOR,
    PRETTIER_MARKDOWN_OVERRIDE,
    EDITORCONFIG_FIXED_SECTIONS,
} from '#cli/config/configurations/general.ts';

const SHFMT_CONFIGURATION = 'bash';

// shfmt reads these keys, and no other tool does. They sit under [*] because shell scripts may have no extension.
const SHFMT_EDITORCONFIG_OPTIONS = { switch_case_indent: true, simplify: true } as const;

const SCRIPT_SECTION = '*.{sh,bash}';

const SCRIPT_EXTENSIONS: ReadonlySet<string> = new Set(['.sh', '.bash']);

const TAB_STEP = 'tab';

/**
List how far each indented line of a script steps in from the line above it, and the tab step for a line that a tab
indents.

@param text the script.
*/
function listIndentSteps(text: string): string[] {
    let previousWidth = 0;
    return text.split('\n').flatMap((line) => {
        const indent = line.slice(0, line.length - line.trimStart().length);
        if (indent.length === line.length) return [];
        if (indent.includes('\t')) return [TAB_STEP];
        const step = indent.length - previousWidth;
        previousWidth = indent.length;
        return step > 0 ? [String(step)] : [];
    });
}

/**
Find the indent that most lines of the .sh and .bash files use, so shfmt keeps the style of the scripts.

@param planned the config file, whose session lists and reads the files.
@returns undefined when no script line is indented.
*/
function detectScriptIndent(planned: PlannedConfig): Record<string, string | number> | undefined {
    const { cache, repository } = planned.session;
    const steps = repository.files
        .filter((file) => file.kind === 'source' && SCRIPT_EXTENSIONS.has(extractExtension(file.path)))
        .flatMap((file) => listIndentSteps(findText(cache, file.path) ?? ''));
    const [step] =
        [...Map.groupBy(steps, (each) => each)].toSorted(
            ([firstStep, firstLines], [secondStep, secondLines]) =>
                secondLines.length - firstLines.length || compareText(firstStep, secondStep),
        )[0] ?? [];
    if (step === undefined) return undefined;
    return step === TAB_STEP ? { indent_style: 'tab' } : { indent_style: 'space', indent_size: Number(step) };
}

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
    const tables: Array<{ scope: string; format: WrittenFormat }> = [];
    for (const { scopePath = '', table } of orderedTables) {
        const authored = table.written['format'];
        if (table.format === undefined || !isTable(authored)) continue;
        const format = Object.fromEntries(
            Object.entries(table.format).filter(([key]) => Object.hasOwn(authored, key)),
        ) as WrittenFormat;
        tables.push({ scope: scopePath, format });
    }
    const base = tables.flatMap(({ scope, format: { override: _overrides, ...format } }) =>
        scope === '' || Object.keys(format).length === 0 ? [] : { scope, paths: ['**/*'], format },
    );
    const overrides = tables.flatMap(({ scope, format }) =>
        (format.override ?? []).map(({ paths, ...format }) => ({
            scope,
            paths: paths.map((path) => joinScopeSelector(path, scope)),
            format,
        })),
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
The indent of .sh and .bash files follows the scripts, and a format override still wins over it.

@param planned the config file to build.
*/
function buildEditorconfigFile(planned: PlannedConfig): string {
    const { format } = planned.scope.settings.tables;
    const settings = planned.session.settings;
    const hasBash = planned.session.scopes.some(({ configurations }) =>
        configurations.some(({ name }) => name === SHFMT_CONFIGURATION),
    );
    const scriptIndent = hasBash ? detectScriptIndent(planned) : undefined;
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
        ...(scriptIndent === undefined ? [] : [{ path: SCRIPT_SECTION, options: scriptIndent }]),
        ...listScopeFormats(settings).flatMap(({ scope, paths, format }) => {
            const options = {
                ...(format.indent_style !== undefined && { indent_style: format.indent_style }),
                ...(format.indent_width !== undefined && { indent_size: format.indent_width }),
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
