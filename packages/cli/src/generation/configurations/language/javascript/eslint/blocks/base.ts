import { escapeGlob } from '#cli/system/paths.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { MISE_SCRIPT_PATH } from '#cli/config/files/names.ts';
import { readScopeAliases } from '#cli/repository/npm/aliases.ts';
import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { getPreset } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import { buildSelectorGroups } from '#cli/generation/configurations/language/javascript/eslint/blocks/selectors.ts';
import { buildRestrictedImportBlocks } from '#cli/generation/configurations/language/javascript/eslint/blocks/settings.ts';

import {
    buildLimitRules,
    buildBarrelRule,
} from '#cli/generation/configurations/language/javascript/eslint/blocks/limits.ts';
import {
    serializePresetAccess,
    serializeProjectPaths,
} from '#cli/generation/configurations/language/javascript/eslint/print.ts';
import {
    buildScopeGlob,
    buildScopeFiles,
    listCodeTestFiles,
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
    type EslintFiles,
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
    IMPORT_LAYOUT_RULES,
    ESLINT_PLUGIN_IMPORTS,
    ROOT_PACKAGE_JSON_RULES,
    BOUNDARIES_PLUGIN_IMPORT,
    LEVEL_ALL_PLUGIN_IMPORTS,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/base.ts';

function buildProjectBlocks(planned: PlannedEslintFile, boundaryBlocks: EslintBlock[]): ConfigurationBlocks['blocks'] {
    const { session, projects } = planned;
    return [
        ...buildImportStyleBlocks(session.scopes, planned.nodeFiles),
        ...buildScopeImportBlocks(planned),
        ...buildNodeScriptBlocks(planned),
        ...boundaryBlocks,
    ].map(({ settings, ...fields }) => {
        if (settings === undefined)
            return {
                fields,
                properties: '',
            };
        const properties =
            settings['boundaries/files'] === undefined
                ? `settings: ${JSON.stringify(settings)}`
                : `settings: { ...${JSON.stringify(settings)}, 'import/resolver': { typescript: { project: [${serializeProjectPaths(projects)}] } } }`;
        return {
            fields,
            properties,
        };
    });
}

/**
Build the blocks before the configuration blocks: default lint rules, pinned presets, and project settings.

@param planned the ESLint context of the scope.
@param plugins the import names and packages to load.
@param boundaryBlocks the project classifications and dependency policies.
@param ignoredGlobs the shared ignored paths.
@returns the blocks for source syntax and lint rules.
*/
export function buildOpeningBlocks(
    planned: PlannedEslintFile,
    plugins: EslintPlugins,
    boundaryBlocks: EslintBlock[],
    ignoredGlobs: string[],
): ConfigurationBlocks['blocks'] {
    const { eslintFiles, session, blockWriter } = planned;
    const rules = planned.levelRules;
    const pluginMap = Object.entries(plugins)
        .map(([name, [importName]]) => `${JSON.stringify(name)}: ${importName}`)
        .join(', ');
    const pluginOptions = Object.fromEntries(
        blockWriter.ruleOptions.flatMap(({ rules }) =>
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
            fields: {
                files: eslintFiles.code,
                rules: {
                    ...rules.code,
                    ...pluginOptions,
                    [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(
                        session.scopes,
                        readScopeAliases(session.root, '', session.reads),
                    ),
                    ...IMPORT_LAYOUT_RULES,
                    ...buildBarrelRule(session.settings, planned.scope.settings, 'typescript'),
                },
            },
            properties: `plugins: { ${pluginMap} }, linterOptions: { reportUnusedDisableDirectives: 'error' }, languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.es2024 }, settings: { gspot: { root }, 'import-x/ignore': ${JSON.stringify(buildImportIgnores(ignoredGlobs))}${boundaryBlocks.length > 0 ? ", 'boundaries/root-path': root" : ''} }`,
            preset: { expression: `gspot.configs.${blockWriter.level}.rules`, rules: {} },
        },
        {
            fields: { files: eslintFiles.javascript, rules: JAVASCRIPT_RULES },
        },
        ...buildProjectBlocks(planned, boundaryBlocks),
        ...buildRestrictedImportBlocks(planned).map((block): ConfigurationBlocks['blocks'][number] => ({
            fields: block,
        })),
    ];
}

function buildRuntimeBlocks(eslintFiles: EslintFiles, runtimeBlocks: EslintRuntime[]): ConfigurationBlocks['blocks'] {
    const runtimes: ConfigurationBlocks['blocks'] = runtimeBlocks.map(({ runtime }, index) => {
        const names = RUNTIME_GLOBALS[runtime] ?? runtime;
        return {
            fields: {
                files: eslintFiles.code.map((pattern) => [pattern, { runtime: index }]),
                rules: {
                    ...(runtime === 'commonjs' && { 'unicorn/prefer-module': 'off' }),
                },
            },
            properties: `languageOptions: { sourceType: ${JSON.stringify(runtime === 'commonjs' ? 'commonjs' : 'module')}, globals: globals[${JSON.stringify(names)}] }`,
        };
    });
    const nodeIndexes = runtimeBlocks.flatMap(({ runtime }, index) => (NODE_RUNTIMES.includes(runtime) ? index : []));
    return [
        ...runtimes,
        {
            fields: {
                files: eslintFiles.code.flatMap((pattern) => nodeIndexes.map((index) => [pattern, { runtime: index }])),
                rules: NODE_RULES,
            },
        },
    ];
}

/**
Build the blocks after the configuration blocks: runtime, selector, test, script, and final pinned rules. The selector
blocks hold the syntax selectors that the configurations and settings add.

@param planned the ESLint context of the scope.
@param runtimeBlocks the runtime declarations shared with file matchers.
@returns the blocks for package and file conventions.
*/
export function buildClosingBlocks(
    planned: PlannedEslintFile,
    runtimeBlocks: EslintRuntime[],
): ConfigurationBlocks['blocks'] {
    const { eslintFiles, session } = planned;
    const { level } = planned.blockWriter;
    const rules = planned.levelRules;
    const presets = planned.eslintPresets.get(JAVASCRIPT_CONFIGURATION);
    const selectorGroups = buildSelectorGroups(session.scopes, level, session.settings.structure.reexports);
    return [
        ...buildRuntimeBlocks(eslintFiles, runtimeBlocks),
        ...selectorGroups.map((group): ConfigurationBlocks['blocks'][number] => ({
            fields: {
                files: buildScopeFiles(eslintFiles.code, group.scope ?? '', group.files ?? ['**/*']),
                ignores: [
                    ...(group.ignoredScopes ?? []).map((scope) => `${escapeGlob(scope)}/**`),
                    ...(group.ignores ?? []),
                ],
                rules: {
                    'no-restricted-syntax': ['error', ...(level === 'all' ? BASE_SELECTORS : []), ...group.selectors],
                },
            },
        })),
        ...buildConsoleBlocks(planned).map((block): ConfigurationBlocks['blocks'][number] => ({
            fields: block,
        })),
        { fields: { files: eslintFiles.scripts, rules: SCRIPT_RULES } },
        { fields: { files: eslintFiles.tests, rules: TEST_RULES } },
        ...buildBasePresetBlocks(presets, PRESETS_AFTER_CONFIGURATIONS, eslintFiles.code),
        {
            fields: {
                files: [PACKAGE_JSON_PATTERN],
                rules: { 'package-json/restrict-dependency-ranges': ['error', { rangeType: 'pin' }] },
            },
        },
        { fields: { files: [PACKAGE_JSON], rules: ROOT_PACKAGE_JSON_RULES } },
        {
            fields: {
                files: eslintFiles.javascript,
                rules: {
                    ...rules.javascript,
                    ...buildBarrelRule(session.settings, planned.scope.settings, 'javascript'),
                },
            },
        },
    ];
}

function buildConsoleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>): EslintBlockFields[] {
    const scopes = planned.session.scopes.filter(({ settings }) =>
        settings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    return scopes.map((scope) => ({
        files: buildScopeFiles(planned.eslintFiles.code, scope.path, ['**/*']),
        ignores: [
            ...listNestedScopeGlobs(
                scopes.map(({ path }) => path),
                scope.path,
            ),
            ...listCodeTestFiles(scope.settings.test_files),

            ...(scope.settings.values.javascript?.script_files ?? []),
            buildScopeGlob(scope.path, MISE_SCRIPT_PATH),
        ],
        rules: CONSOLE_RULES,
    }));
}

/**
Choose the plugin imports and names for the module header and the lint blocks.

@param planned the ESLint context of the scope.
@param boundaryBlocks the project classifications that require the boundaries plugin.
@returns the ESLint plugins to load.
*/
export function selectPlugins(planned: PlannedEslintFile, boundaryBlocks: EslintBlock[]): EslintPlugins {
    const isAll = planned.blockWriter.level === 'all';
    const repositorySettings = planned.session.settings;
    return {
        ...ESLINT_PLUGIN_IMPORTS,
        ...(isAll && { perfectionist: LEVEL_ALL_PLUGIN_IMPORTS.perfectionist }),
        ...(isAll &&
            repositorySettings.structure.reexports === 'index-only' && {
                'barrel-files': LEVEL_ALL_PLUGIN_IMPORTS['barrel-files'],
            }),
        ...(boundaryBlocks.length > 0 && BOUNDARIES_PLUGIN_IMPORT),
    };
}

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
            fields: { ...fields, files: fields.files ?? codeFiles },
            properties: `...${source}`,
            preset: { expression: `${source}.rules`, rules: fields.rules },
        };
    });
}

/**
Calculate the ESLint limit options from the settings. JavaScript files get the JavaScript limits in their own
block, which comes after the block for every code file.

@param scopeSettings the settings that the limits read.
@param selectors the syntax patterns and their paths.

@returns the lint rules at this level.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The base rule sets and limit rules it reads stay private to this file.
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
    };
}
