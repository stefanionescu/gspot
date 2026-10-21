import { escapeGlob } from '#cli/repository/matchers.ts';
import { getPreset } from '#cli/generation/eslint/presets.ts';
import { readScopeAliases } from '#cli/repository/aliases.ts';
import { getTable, getLimit } from '#cli/settings/scope-view.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import type { ScopeView } from '#cli/types/settings/inheritance.ts';
import { listScriptPaths } from '#cli/generation/eslint/runtimes.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { IMPORT_BOUNDARIES_RULE } from '#cli/config/generation/eslint/imports.ts';
import { buildScopeFiles, listNestedScopeGlobs } from '#cli/generation/eslint/files.ts';
import { buildRestrictedImportBlocks } from '#cli/generation/eslint/settings-blocks.ts';

import {
    buildImportIgnores,
    buildNodeScriptBlocks,
    buildImportStyleBlocks,
    buildScopeImportBlocks,
    buildImportBoundariesRule,
} from '#cli/generation/eslint/imports.ts';
import {
    BASE_RULES,
    NODE_RULES,
    TEST_RULES,
    SCRIPT_RULES,
    CONSOLE_RULES,
    BASE_SELECTORS,
    JAVASCRIPT_RULES,
    ROOT_PACKAGE_JSON_RULES,
} from '#cli/config/generation/eslint/rules.ts';
import {
    type EslintBlock,
    type EslintPlugins,
    type SelectorGroup,
    type EslintPresets,
    type EslintRuntime,
    type EslintLevelRules,
    type PlannedEslintFile,
    type EslintBlockFields,
    type ConfigurationBlocks,
} from '#cli/types/generation/eslint.ts';
import {
    NODE_RUNTIMES,
    RUNTIME_GLOBALS,
    BARREL_FILES_RULE,
    ESLINT_LIMIT_RULES,
    IMPORT_LAYOUT_RULES,
    PACKAGE_JSON_PATTERN,
    ESLINT_PLUGIN_IMPORTS,
    BOUNDARIES_PLUGIN_IMPORT,
    LEVEL_ALL_PLUGIN_IMPORTS,
    PRESETS_AFTER_CONFIGURATIONS,
    PRESETS_BEFORE_CONFIGURATIONS,
} from '#cli/config/generation/eslint/base.ts';

// Project settings preserve their runtime expressions while rule data stays serializable.
function buildProjectBlocks(planned: PlannedEslintFile, boundaryBlocks: EslintBlock[]): ConfigurationBlocks['blocks'] {
    const { session, projects } = planned;
    return [
        ...buildImportStyleBlocks(session.scopes, planned.nodeFiles),
        ...buildScopeImportBlocks(planned),
        ...buildNodeScriptBlocks(planned),
        ...boundaryBlocks,
    ].map(({ settings, ...data }) => {
        if (settings === undefined)
            return {
                data: data,
                properties: '',
            };
        const runtime =
            settings['boundaries/files'] === undefined
                ? `settings: ${JSON.stringify(settings)}`
                : `settings: { ...${JSON.stringify(settings)}, 'import/resolver': { typescript: { project: joinRoot(${JSON.stringify(projects)}) } } }`;
        return {
            data: data,
            properties: runtime,
        };
    });
}
/**
 * Build the blocks before the fragment blocks: default lint rules, pinned presets, and project settings.
 *
 * @param planned the ESLint context of the scope.
 * @param plugins the import names and packages to load.
 * @param boundaryBlocks the project classifications and dependency policies.
 * @param ignoredGlobs the shared ignored paths.
 *
 * @returns the blocks for source syntax and lint rules.
 */
export function buildOpeningBlocks(
    planned: PlannedEslintFile,
    plugins: EslintPlugins,
    boundaryBlocks: EslintBlock[],
    ignoredGlobs: string[],
): ConfigurationBlocks['blocks'] {
    const { eslintFiles, session } = planned;
    const isAll = planned.level === 'all';
    const rules = planned.levelRules;
    const pluginMap = Object.entries(plugins)
        .map(([name, [importName]]) => `${JSON.stringify(name)}: ${importName}`)
        .join(', ');
    const pluginOptions = Object.fromEntries(
        planned.ruleOptions.flatMap(({ rules }) =>
            Object.keys(rules)
                .filter((name) => name.startsWith('gspot/'))
                .map((name) => [name, 'error']),
        ),
    );
    return [
        ...buildBasePresetBlocks(
            planned.eslintPresets.get(JAVASCRIPT_CONFIGURATION),
            PRESETS_BEFORE_CONFIGURATIONS,
            eslintFiles.code,
        ),
        {
            data: {
                files: eslintFiles.code,
                rules: {
                    ...rules.code,
                    ...pluginOptions,
                    [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(
                        session.scopes,
                        readScopeAliases(session.root, '', session.reads),
                    ),
                    ...IMPORT_LAYOUT_RULES,
                    ...buildBarrelRule(planned, 'typescript'),
                },
            },
            properties: `plugins: { ${pluginMap} }, linterOptions: { reportUnusedDisableDirectives: 'error' }, languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.es2024 }, settings: { gspot: { root }, 'import-x/ignore': ${JSON.stringify(buildImportIgnores(ignoredGlobs))}${boundaryBlocks.length > 0 ? ", 'boundaries/root-path': root" : ''} }`,
            preset: { expression: `gspot.configs.${isAll ? 'all' : 'recommended'}.rules`, rules: {} },
        },
        {
            data: { files: eslintFiles.javascript, rules: JAVASCRIPT_RULES },
        },
        ...buildProjectBlocks(planned, boundaryBlocks),
        ...buildRestrictedImportBlocks(planned).map((block): ConfigurationBlocks['blocks'][number] => ({
            data: block,
        })),
    ];
}
/**
 * Build the blocks after the fragment blocks: runtime, selector, test, script, and final pinned rules.
 *
 * @param planned the ESLint context of the scope.
 * @param selectorGroups the selectors that fragments add.
 * @param runtimeBlocks the runtime declarations shared with file matchers.
 *
 * @returns the blocks for package and file conventions.
 */
export function buildClosingBlocks(
    planned: PlannedEslintFile,
    selectorGroups: SelectorGroup[],
    runtimeBlocks: EslintRuntime[],
): ConfigurationBlocks['blocks'] {
    const { eslintFiles } = planned;
    const isAll = planned.level === 'all';
    const rules = planned.levelRules;
    const presets = planned.eslintPresets.get(JAVASCRIPT_CONFIGURATION);
    const runtimes: ConfigurationBlocks['blocks'] = runtimeBlocks.map(({ runtime }, index) => {
        const isNode = NODE_RUNTIMES.includes(runtime);
        const names = RUNTIME_GLOBALS[runtime] ?? runtime;
        return {
            data: {
                files: eslintFiles.code.map((pattern) => [pattern, { runtime: index }]),
                rules: {
                    ...(isNode ? rules.node : {}),
                    ...(runtime === 'commonjs' ? { 'unicorn/prefer-module': 'off' } : {}),
                },
            },
            properties: `languageOptions: { sourceType: ${JSON.stringify(runtime === 'commonjs' ? 'commonjs' : 'module')}, globals: globals[${JSON.stringify(names)}] }`,
        };
    });
    return [
        ...runtimes,
        ...selectorGroups.map((group): ConfigurationBlocks['blocks'][number] => ({
            data: {
                files: buildScopeFiles(eslintFiles.code, group.scope ?? '', group.files ?? ['**/*']),
                ignores: [
                    ...(group.ignoredScopes ?? []).map((scope) => `${escapeGlob(scope)}/**`),
                    ...(group.ignores ?? []),
                ],
                rules: { 'no-restricted-syntax': ['error', ...(isAll ? BASE_SELECTORS : []), ...group.selectors] },
            },
        })),
        ...buildConsoleBlocks(planned, rules.console).map((block): ConfigurationBlocks['blocks'][number] => ({
            data: block,
        })),
        {
            data: { files: eslintFiles.scripts, rules: SCRIPT_RULES },
        },
        {
            data: { files: eslintFiles.tests, rules: TEST_RULES },
        },
        ...buildBasePresetBlocks(presets, PRESETS_AFTER_CONFIGURATIONS, eslintFiles.code),
        {
            data: {
                files: [PACKAGE_JSON_PATTERN],
                rules: { 'package-json/restrict-dependency-ranges': ['error', { rangeType: 'pin' }] },
            },
        },
        { data: { files: [PACKAGE_JSON], rules: ROOT_PACKAGE_JSON_RULES } },
        {
            data: {
                files: eslintFiles.javascript,
                rules: { ...rules.javascript, ...buildBarrelRule(planned, 'javascript') },
            },
        },
    ];
}
/**
 * Keep test and script console exemptions inside their project scope.
 *
 * @param planned every scope and the generated code selectors.
 * @param rules the console restrictions at the selected level.
 * @returns one console block per JavaScript scope.
 */
function buildConsoleBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>,
    rules: EslintLevelRules['console'],
): EslintBlockFields[] {
    const scopes = planned.session.scopes.filter(({ view }) => view.configurations.includes(JAVASCRIPT_CONFIGURATION));
    return scopes.map((selection) => ({
        files: buildScopeFiles(planned.eslintFiles.code, selection.scope.path, ['**/*']),
        ignores: [
            ...listNestedScopeGlobs(
                scopes.map(({ scope }) => scope.path),
                selection.scope.path,
            ),
            ...selection.view.test_files,
            ...listScriptPaths(selection),
        ],
        rules,
    }));
}
/**
 * Choose the plugin imports and names for the module header and the lint blocks.
 *
 * @param planned the ESLint context of the scope.
 * @param boundaryBlocks the project classifications that require the boundaries plugin.
 *
 * @returns the ESLint plugins to load.
 */
export function selectPlugins(planned: PlannedEslintFile, boundaryBlocks: EslintBlock[]): EslintPlugins {
    const isAll = planned.level === 'all';
    const repositorySettings = planned.session.settingsFile.settings;
    return {
        ...ESLINT_PLUGIN_IMPORTS,
        ...(isAll ? { perfectionist: LEVEL_ALL_PLUGIN_IMPORTS.perfectionist } : {}),
        ...(isAll && repositorySettings.structure.reexports === 'index-only'
            ? { 'barrel-files': LEVEL_ALL_PLUGIN_IMPORTS['barrel-files'] }
            : {}),
        ...(boundaryBlocks.length > 0 ? BOUNDARIES_PLUGIN_IMPORT : {}),
    };
}
// A language block uses its own index-export limit whenever the repository permits barrels.
function buildBarrelRule(planned: PlannedEslintFile, language: 'typescript' | 'javascript'): Record<string, unknown> {
    return planned.session.settingsFile.settings.structure.reexports === 'index-only'
        ? {
              [BARREL_FILES_RULE]: [
                  'error',
                  {
                      amountOfExportsToConsiderModuleAsBarrel: getLimit(
                          planned.selection.view,
                          'index_exports',
                          language,
                      ),
                  },
              ],
          }
        : {};
}
// Base presets use their first block as an object; framework presets preserve their complete block arrays.
function buildBasePresetBlocks(
    presets: EslintPresets | undefined,
    sources: readonly (readonly [string, string])[],
    codeFiles: string[],
): ConfigurationBlocks['blocks'] {
    return sources.map(([name, importName]) => {
        const selected = getPreset(presets, name);
        const { parser: _parser, ...fields } = selected.blocks[0];
        const source = serializePresetAccess(importName, selected.source);
        return {
            data: { ...fields, files: fields.files ?? codeFiles },
            properties: `...${source}`,
            preset: { expression: `${source}.rules`, rules: fields.rules },
        };
    });
}
// The size and complexity rules with the limits of one language.
function buildLimitRules(view: ScopeView, language: 'typescript' | 'javascript'): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(ESLINT_LIMIT_RULES).map(([rule, limitRule]) => {
            const maximum = getLimit(view, limitRule.limit, language);
            return [rule, ['error', 'options' in limitRule ? { max: maximum, ...limitRule.options } : maximum]];
        }),
    );
}
/**
 * Calculate the ESLint limit options from the settings. JavaScript files get the JavaScript limits in their own
 * block, which comes after the block for every code file.
 *
 * @param view the settings that the limits read.
 * @param selectors the syntax patterns and their paths.
 *
 * @returns the lint rules at this level.
 */
export function buildLevelRules(view: ScopeView, selectors: Readonly<SelectorGroup['selectors']>): EslintLevelRules {
    return {
        code: {
            ...BASE_RULES,
            'no-restricted-syntax': ['error', ...selectors],
            ...buildLimitRules(view, 'typescript'),
            'sonarjs/no-identical-functions': ['error', getTable(view, 'duplication').min_lines],
        },
        javascript: buildLimitRules(view, 'javascript'),
        node: NODE_RULES,
        console: CONSOLE_RULES,
    };
}
