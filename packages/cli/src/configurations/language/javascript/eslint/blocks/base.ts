import { basename } from 'node:path/posix';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { escapeGlob, extractParentFolder } from '#cli/system/paths.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { readScopeAliases } from '#cli/repository/javascript/aliases.ts';
import { MISE_TASKS_GLOB } from '#cli/config/configurations/structure.ts';
import { DENO_CONFIG_FILES } from '#cli/config/configurations/infrastructure.ts';
import { SCRIPT_RULES, CONSOLE_RULES, JAVASCRIPT_RULES } from '#cli/config/configurations/eslint.ts';
import { buildSelectorBlocks } from '#cli/configurations/language/javascript/eslint/blocks/selectors.ts';
import { buildScopeFiles, listCodeTestFiles } from '#cli/configurations/language/javascript/eslint/files.ts';
import { buildLocalPluginBlocks } from '#cli/configurations/language/javascript/eslint/blocks/local-plugins.ts';

import {
    splitSettingsBlocks,
    buildRestrictedImportBlocks,
} from '#cli/configurations/language/javascript/eslint/blocks/settings.ts';
import type {
    EslintBlock,
    EslintFiles,
    EslintRuntime,
    ListedPlugins,
    EslintBlockFields,
    PlannedEslintFile,
    ConfigurationBlocks,
} from '#cli/types/configurations/language.ts';
import {
    buildImportIgnores,
    buildNodeScriptBlocks,
    buildImportStyleBlocks,
    buildScopeImportBlocks,
    buildImportBoundariesRule,
} from '#cli/configurations/language/javascript/eslint/blocks/imports.ts';
import {
    NODE_RULES,
    TEST_RULES,
    NODE_RUNTIMES,
    RUNTIME_GLOBALS,
    PIN_RANGES_RULE,
    SCRIPT_NAMES_RULE,
    GSPOT_RULE_PREFIX,
    GSPOT_PRESET_LEVELS,
    IMPORT_LAYOUT_RULES,
    PRIVATE_PIN_OPTIONS,
    PACKAGE_JSON_PATTERN,
    PUBLISHED_PIN_OPTIONS,
    IMPORT_BOUNDARIES_RULE,
    RESTRICTED_SYNTAX_RULE,
    ROOT_PACKAGE_JSON_RULES,
    JAVASCRIPT_CONFIGURATION,
    BOUNDARIES_FILES_SETTING,
    PRESETS_AFTER_CONFIGURATIONS,
    PRESETS_BEFORE_CONFIGURATIONS,
} from '#cli/config/configurations/blocks.ts';

function buildProjectBlocks(planned: PlannedEslintFile, boundaryBlocks: EslintBlock[]): ConfigurationBlocks {
    const { session, projects } = planned;
    return [
        ...buildImportStyleBlocks(
            session.scopes,
            planned.nodeFiles,
            new Set(
                session.repository.files
                    .filter((file) => (DENO_CONFIG_FILES as readonly string[]).includes(basename(file.path)))
                    .map((file) => extractParentFolder(file.path)),
            ),
        ),
        ...buildScopeImportBlocks(planned),
        ...buildNodeScriptBlocks(planned),
        ...boundaryBlocks,
    ].map((fields) => ({
        fields,
        ...(fields.settings?.[BOUNDARIES_FILES_SETTING] === undefined
            ? {}
            : {
                  calls: [{ name: 'setBoundaryLookup', args: [{ value: projects }] }],
              }),
    }));
}

function buildRootBlock(
    planned: PlannedEslintFile,
    plugins: ListedPlugins,
    boundaryBlocks: EslintBlock[],
    ignoredGlobs: string[],
): ConfigurationBlocks[number] {
    const { eslintFiles, session, blockWriter } = planned;
    const rules = planned.levelRules;
    const pluginOptions = Object.fromEntries(
        blockWriter.ruleOptions.flatMap(({ rules }) =>
            Object.keys(rules)
                .filter((name) => name.startsWith(GSPOT_RULE_PREFIX))
                .map((name) => [name, 'error']),
        ),
    );
    return {
        fields: {
            files: eslintFiles.code,
            linterOptions: { reportUnusedDisableDirectives: 'error' },
            languageOptions: { ecmaVersion: 'latest' },
            settings: { 'import-x/ignore': buildImportIgnores(ignoredGlobs) },
            rules: {
                ...rules.code,
                ...pluginOptions,
                [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(
                    session.scopes,
                    readScopeAliases(session.root, '', session.cache),
                ),
                ...IMPORT_LAYOUT_RULES,
            },
        },
        calls: [
            { name: 'addPlugins', args: [plugins] },
            { name: 'setRuntime', args: [{ package: 'globals' }, { value: 'es2024' }, { value: 'module' }] },
            {
                name: 'setRootFolder',
                args: [
                    {
                        value: [
                            ['settings', 'gspot', 'root'],
                            ...(boundaryBlocks.length > 0 ? [['settings', 'boundaries/root-path']] : []),
                        ],
                    },
                ],
            },
        ],
        presets: [
            {
                package: '@gspothq/eslint-plugin',
                path: `configs.${GSPOT_PRESET_LEVELS[blockWriter.level]}`,
                merge: 'rules',
            },
        ],
    };
}

function buildRuntimeBlocks(eslintFiles: EslintFiles, runtimeBlocks: EslintRuntime[]): ConfigurationBlocks {
    const runtimes: ConfigurationBlocks = runtimeBlocks.map(({ runtime }, index) => {
        const names = RUNTIME_GLOBALS[runtime] ?? runtime;
        return {
            fields: {
                files: eslintFiles.code.map((pattern) => [pattern, { runtime: index }]),
                rules: {
                    ...(runtime === 'commonjs' && { 'unicorn/prefer-module': 'off' }),
                },
            },
            calls: [
                {
                    name: 'setRuntime',
                    args: [
                        { package: 'globals' },
                        { value: names },
                        { value: runtime === 'commonjs' ? 'commonjs' : 'module' },
                    ],
                },
            ],
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

function buildConsoleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>): EslintBlockFields[] {
    const scopes = planned.session.scopes.filter(({ settings }) =>
        settings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    return scopes.map((scope) => ({
        files: buildScopeFiles(planned.eslintFiles.code, scope.path, ['**/*']),
        ignores: [
            ...listNestedScopes(
                scopes.map(({ path }) => path),
                scope.path,
            ).map((path) => joinScope(escapeGlob(path), '**')),
            ...listCodeTestFiles(scope.settings.test_files),

            ...(scope.settings.tables.javascript?.script_files ?? []),
            joinScope(escapeGlob(scope.path), MISE_TASKS_GLOB),
        ],
        rules: CONSOLE_RULES,
    }));
}

/**
Build the blocks before the configuration blocks: default lint rules, pinned presets, and project settings.

@param planned the ESLint context of the scope.
@param plugins the shipped plugin packages and the local plugins to load.
@param boundaryBlocks the project classifications and dependency policies.
@param ignoredGlobs the shared ignored paths.
*/
export function buildOpeningBlocks(
    planned: PlannedEslintFile,
    plugins: ListedPlugins,
    boundaryBlocks: EslintBlock[],
    ignoredGlobs: string[],
): ConfigurationBlocks {
    const { eslintFiles } = planned;
    return [
        ...PRESETS_BEFORE_CONFIGURATIONS.map((preset) => ({
            fields: { files: eslintFiles.code },
            presets: [
                {
                    package: preset.package,
                    path: planned.blockWriter.level === 'all' && 'allPath' in preset ? preset.allPath : preset.path,
                    merge: 'fields' as const,
                },
            ],
        })),
        buildRootBlock(planned, plugins, boundaryBlocks, ignoredGlobs),
        {
            fields: { files: eslintFiles.javascript, rules: JAVASCRIPT_RULES },
        },
        ...buildProjectBlocks(planned, boundaryBlocks),
        ...buildRestrictedImportBlocks(planned).map((block): ConfigurationBlocks[number] => ({
            fields: block,
        })),
    ];
}

/**
Build the blocks after the configuration blocks: runtime, selector, test, script, final pinned rules, your settings,
and the rules that wait for level all.

@param planned the ESLint context of the scope.
*/
export function buildClosingBlocks(planned: PlannedEslintFile): ConfigurationBlocks {
    const { eslintFiles, session } = planned;
    const { level, runtimes, allLevelRules } = planned.blockWriter;
    const rules = planned.levelRules;
    const privatePackages = session.repository.files
        .filter(
            (file) =>
                file.kind === 'source' &&
                basename(file.path) === PACKAGE_JSON &&
                readPackageJson(session.cache, file.path)?.['private'] === true,
        )
        .map((file) => escapeGlob(file.path));
    const selectorGroups = buildSelectorBlocks(session.scopes, level, session.repository.dependencyFiles);
    return [
        ...buildRuntimeBlocks(eslintFiles, runtimes),
        ...selectorGroups
            .filter((group) => group.selectors.length > 0)
            .map((group): ConfigurationBlocks[number] => ({
                fields: {
                    files: buildScopeFiles(eslintFiles.code, group.scope, ['**/*']),
                    ignores: group.ignoredScopes.map((scope) => `${escapeGlob(scope)}/**`),
                    rules: { [RESTRICTED_SYNTAX_RULE]: ['error', ...group.selectors] },
                },
            })),
        ...buildConsoleBlocks(planned).map((block): ConfigurationBlocks[number] => ({
            fields: block,
        })),
        { fields: { files: eslintFiles.scripts, rules: SCRIPT_RULES } },
        { fields: { files: eslintFiles.tests, rules: TEST_RULES } },
        ...PRESETS_AFTER_CONFIGURATIONS.map((preset) => ({
            fields: { files: 'files' in preset ? [...preset.files] : eslintFiles.code },
            presets: [{ ...preset, merge: 'fields' as const }],
        })),
        {
            fields: {
                files: [PACKAGE_JSON_PATTERN],
                rules: { [PIN_RANGES_RULE]: ['error', PUBLISHED_PIN_OPTIONS], [SCRIPT_NAMES_RULE]: 'error' },
            },
        },
        ...(privatePackages.length === 0
            ? []
            : [{ fields: { files: privatePackages, rules: { [PIN_RANGES_RULE]: ['error', PRIVATE_PIN_OPTIONS] } } }]),
        { fields: { files: [PACKAGE_JSON], rules: ROOT_PACKAGE_JSON_RULES } },
        {
            fields: {
                files: eslintFiles.javascript,
                rules: rules.javascript,
            },
        },
        ...[...splitSettingsBlocks(planned), ...buildLocalPluginBlocks(session.scopes, eslintFiles.code)].map(
            (fields) => ({ fields }),
        ),
        ...(level === 'all'
            ? []
            : [{ fields: { rules: Object.fromEntries([...allLevelRules].map((rule) => [rule, 'off'])) } }]),
    ];
}
