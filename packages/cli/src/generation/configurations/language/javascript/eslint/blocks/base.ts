import { joinScope } from '#cli/repository/scopes.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { getLimit, getTable } from '#cli/settings/scopes.ts';
import { MISE_SCRIPT_PATH } from '#cli/config/files/names.ts';
import { readScopeAliases } from '#cli/repository/npm/aliases.ts';
import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/files/path-patterns.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { getPreset } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import { serializePresetAccess } from '#cli/generation/configurations/language/javascript/eslint/print.ts';
import { buildRestrictedImportBlocks } from '#cli/generation/configurations/language/javascript/eslint/blocks/settings.ts';

import {
    buildScopeFiles,
    listNestedScopeGlobs,
} from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import {
    buildImportIgnores,
    buildNodeScriptBlocks,
    buildImportStyleBlocks,
    buildScopeImportBlocks,
    buildImportBoundariesRule,
} from '#cli/generation/configurations/language/javascript/eslint/blocks/imports.ts';
import {
    BASE_SELECTORS,
    PACKAGE_JSON_PATTERN,
    IMPORT_BOUNDARIES_RULE,
    PRESETS_AFTER_CONFIGURATIONS,
    PRESETS_BEFORE_CONFIGURATIONS,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import {
    type EslintBlock,
    type EslintPlugins,
    type EslintPresets,
    type EslintRuntime,
    type SelectorGroup,
    type EslintLevelRules,
    type EslintBlockFields,
    type PlannedEslintFile,
    type ConfigurationBlocks,
} from '#cli/types/generation/eslint.ts';
import {
    NODE_RULES,
    BASE_RULES,
    TEST_RULES,
    SCRIPT_RULES,
    CONSOLE_RULES,
    NODE_RUNTIMES,
    RUNTIME_GLOBALS,
    JAVASCRIPT_RULES,
    BARREL_FILES_RULE,
    ESLINT_LIMIT_RULES,
    IMPORT_LAYOUT_RULES,
    ESLINT_PLUGIN_IMPORTS,
    ROOT_PACKAGE_JSON_RULES,
    BOUNDARIES_PLUGIN_IMPORT,
    LEVEL_ALL_PLUGIN_IMPORTS,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/base.ts';

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
                data,
                properties: '',
            };
        // Each TypeScript project resolves against the repository root of the generated config file.
        const projectPaths = projects.map((project) => 'join(root, ' + JSON.stringify(project) + ')').join(', ');
        const runtime =
            settings['boundaries/files'] === undefined
                ? `settings: ${JSON.stringify(settings)}`
                : `settings: { ...${JSON.stringify(settings)}, 'import/resolver': { typescript: { project: [${projectPaths}] } } }`;
        return {
            data,
            properties: runtime,
        };
    });
}

/**
 * Build the blocks before the configuration blocks: default lint rules, pinned presets, and project settings.
 *
 * @param planned the ESLint context of the scope.
 * @param plugins the import names and packages to load.
 * @param boundaryBlocks the project classifications and dependency policies.
 * @param ignoredGlobs the shared ignored paths.
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
 * Build the blocks after the configuration blocks: runtime, selector, test, script, and final pinned rules.
 *
 * @param planned the ESLint context of the scope.
 * @param selectorGroups the syntax selectors that the configurations and settings add.
 * @param runtimeBlocks the runtime declarations shared with file matchers.
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
                    ...(group.ignoredScopes ?? []).map(
                        (scope) => `${scope.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH)}/**`,
                    ),
                    ...(group.ignores ?? []),
                ],
                rules: { 'no-restricted-syntax': ['error', ...(isAll ? BASE_SELECTORS : []), ...group.selectors] },
            },
        })),
        ...buildConsoleBlocks(planned, rules.console).map((block): ConfigurationBlocks['blocks'][number] => ({
            data: block,
        })),
        { data: { files: eslintFiles.scripts, rules: SCRIPT_RULES } },
        { data: { files: eslintFiles.tests, rules: TEST_RULES } },
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
    const scopes = planned.session.scopes.filter(({ settings }) =>
        settings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    return scopes.map((scope) => ({
        files: buildScopeFiles(planned.eslintFiles.code, scope.folder.path, ['**/*']),
        ignores: [
            ...listNestedScopeGlobs(
                scopes.map(({ folder }) => folder.path),
                scope.folder.path,
            ),
            ...scope.settings.test_files,

            ...(scope.settings.values.javascript?.script_files ?? []),
            joinScope(scope.folder.path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH), MISE_SCRIPT_PATH),
        ],
        rules,
    }));
}

/**
 * Choose the plugin imports and names for the module header and the lint blocks.
 *
 * @param planned the ESLint context of the scope.
 * @param boundaryBlocks the project classifications that require the boundaries plugin.
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
                          planned.scope.settings,
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
function buildLimitRules(settings: ScopeSettings, language: 'typescript' | 'javascript'): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(ESLINT_LIMIT_RULES).map(([rule, limitRule]) => {
            const maximum = getLimit(settings, limitRule.limit, language);
            return [rule, ['error', 'options' in limitRule ? { max: maximum, ...limitRule.options } : maximum]];
        }),
    );
}

/**
 * Calculate the ESLint limit options from the settings. JavaScript files get the JavaScript limits in their own
 * block, which comes after the block for every code file.
 *
 * @param scopeSettings the settings that the limits read.
 * @param selectors the syntax patterns and their paths.
 *
 * @returns the lint rules at this level.
 */
export function buildLevelRules(
    scopeSettings: ScopeSettings,
    selectors: Readonly<SelectorGroup['selectors']>,
): EslintLevelRules {
    return {
        code: {
            ...BASE_RULES,
            'no-restricted-syntax': ['error', ...selectors],
            ...buildLimitRules(scopeSettings, 'typescript'),
            'sonarjs/no-identical-functions': ['error', getTable(scopeSettings, 'duplication').min_lines],
        },
        javascript: buildLimitRules(scopeSettings, 'javascript'),
        node: NODE_RULES,
        console: CONSOLE_RULES,
    };
}
