import { stripUndefined } from '#cli/system/values.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { buildScopeFiles } from '#cli/generation/eslint/files.ts';
import { listScriptPaths } from '#cli/generation/eslint/runtimes.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { pickPresetFields, buildPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { buildLevelRules, buildRestrictedImportBlocks } from '#cli/generation/eslint/lint-rules.ts';

import {
    CODE_PRESETS,
    FILE_PRESETS,
    PACKAGE_JSON_PATTERN,
    ESLINT_PLUGIN_IMPORTS,
} from '#cli/config/generation/eslint.ts';
import {
    TEST_RULES,
    SCRIPT_RULES,
    BASE_SELECTORS,
    JAVASCRIPT_RULES,
    ROOT_PACKAGE_JSON_RULES,
} from '#cli/config/generation/eslint-rules.ts';
import {
    type BlockWriter,
    type EslintPlugins,
    type SelectorGroup,
    type EslintContext,
    type EslintPresets,
    type EslintLevelRules,
    type EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

/**
 * Build the blocks before the fragment blocks: default lint rules, pinned presets, and project settings.
 *
 * @param base the ESLint context of the scope.
 * @param view the resolved scope settings.
 * @param plugins the import names and packages to load.
 *
 * @returns the blocks for source syntax and lint rules.
 */
function buildBlocksBeforeFragments(
    base: EslintContext,
    view: Pick<ScopeView, 'limit' | 'options'>,
    plugins: EslintPlugins,
): Parameters<BlockWriter['block']>[] {
    const { eslintFiles, isAll } = base;
    const parts = base.eslint;
    const rules = buildLevelRules(view, isAll ? BASE_SELECTORS : []);
    const pluginMap = Object.entries(plugins)
        .map(([name, [importName]]) => `${JSON.stringify(name)}: ${importName}`)
        .join(', ');
    const pluginOptions = Object.fromEntries(
        base.ruleOptions.flatMap(({ rules }) =>
            Object.keys(rules)
                .filter((name) => name.startsWith('gspot/'))
                .map((name) => [name, 'error']),
        ),
    );
    const projectBlocks: Parameters<BlockWriter['block']>[] = [
        ...parts.importStyleBlocks,
        ...parts.scopeBlocks,
        ...parts.boundaryBlocks,
    ].map(({ settings, ...data }) => {
        if (settings === undefined) return [data, ''];
        const runtime =
            settings['boundaries/files'] === undefined
                ? `settings: ${JSON.stringify(settings)}`
                : `settings: { ...${JSON.stringify(settings)}, 'import/resolver': { typescript: { project: ${JSON.stringify(parts.projects)}.map((project) => join(root, project)) } } }`;
        return [data, runtime];
    });
    return [
        ...buildBasePresetBlocks(base.eslintPresets.get('javascript') as EslintPresets, CODE_PRESETS, eslintFiles.code),
        [
            { files: eslintFiles.code, rules: { ...rules.code, ...pluginOptions, ...parts.allLevelRules } },
            `plugins: { ${pluginMap} }, linterOptions: { reportUnusedDisableDirectives: 'error' }, languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.es2024 }, settings: { gspot: { root }, 'import-x/ignore': ${JSON.stringify(parts.importIgnores)}${parts.boundaryBlocks.length > 0 ? ", 'boundaries/root-path': root" : ''} }`,
            { expression: `gspot.configs.${isAll ? 'all' : 'recommended'}.rules`, rules: {} },
        ],
        [{ files: eslintFiles.javascript, rules: JAVASCRIPT_RULES }],
        ...projectBlocks,
        ...buildRestrictedImportBlocks(base).map((block): Parameters<BlockWriter['block']> => [block]),
    ];
}

/**
 * Build the blocks after the fragment blocks: runtime, selector, test, script, and final pinned rules.
 *
 * @param base the ESLint context of the scope.
 * @param view the resolved scope settings.
 * @param fragmentSelectors the selectors that fragments add.
 *
 * @returns the blocks for package and file conventions.
 */
function buildBlocksAfterFragments(
    base: EslintContext,
    view: Pick<ScopeView, 'limit' | 'options'>,
    fragmentSelectors: SelectorGroup[],
): Parameters<BlockWriter['block']>[] {
    const { eslintFiles, isAll } = base;
    const parts = base.eslint;
    const selectors = isAll ? BASE_SELECTORS : [];
    const rules = buildLevelRules(view, selectors);
    const runtimes: Parameters<BlockWriter['block']>[] = parts.runtimes.map(({ runtime }, index) => {
        const isNode = ['node', 'nodeBuiltin', 'commonjs'].includes(runtime);
        let names = runtime;
        if (runtime === 'node') names = 'nodeBuiltin';
        if (runtime === 'commonjs') names = 'node';
        return [
            {
                files: eslintFiles.code.map((pattern) => [
                    pattern,
                    { runtime: { declarations: parts.runtimes, index } },
                ]),
                rules: {
                    ...(isNode ? rules.node : {}),
                    ...(runtime === 'commonjs' ? { 'unicorn/prefer-module': 'off' } : {}),
                },
            },
            `languageOptions: { sourceType: ${JSON.stringify(runtime === 'commonjs' ? 'commonjs' : 'module')}, globals: globals[${JSON.stringify(names)}] }`,
        ];
    });
    const rootPackage: Parameters<BlockWriter['block']>[] = isAll
        ? [[{ files: [PACKAGE_JSON], rules: ROOT_PACKAGE_JSON_RULES }]]
        : [];
    return [
        ...runtimes,
        ...fragmentSelectors.map(
            (group): Parameters<BlockWriter['block']> => [
                {
                    files: buildScopeFiles(eslintFiles.code, group.scope ?? '', group.files ?? ['**/*']),
                    ignores: [
                        ...(group.ignoredScopes ?? []).map((scope) => `${escapeGlob(scope)}/**`),
                        ...(group.ignores ?? []),
                    ],
                    rules: { 'no-restricted-syntax': ['error', ...selectors, ...group.selectors] },
                },
            ],
        ),
        ...buildConsoleBlocks(base, rules.console).map((block): Parameters<BlockWriter['block']> => [block]),
        [{ files: eslintFiles.scripts, rules: SCRIPT_RULES }],
        [{ files: eslintFiles.tests, rules: TEST_RULES }],
        ...buildBasePresetBlocks(base.eslintPresets.get('javascript') as EslintPresets, FILE_PRESETS, eslintFiles.code),
        [
            {
                files: [PACKAGE_JSON_PATTERN],
                rules: { 'package-json/restrict-dependency-ranges': ['error', { rangeType: 'pin' }] },
            },
        ],
        ...rootPackage,
        [{ files: eslintFiles.javascript, rules: { ...rules.javascript, ...parts.javascriptAllLevelRules } }],
    ];
}

/**
 * Keep test and script console exemptions inside their project scope.
 *
 * @param input every scope and the generated code selectors.
 * @param rules the console restrictions at the selected level.
 * @returns one console block per JavaScript scope.
 */
function buildConsoleBlocks(
    input: Pick<EslintContext, 'scopes' | 'eslintFiles'>,
    rules: EslintLevelRules['console'],
): EslintSettingsBlock[] {
    const scopes = input.scopes.filter(({ view }) => view.configurations.includes('javascript'));
    return scopes.map((selection) => ({
        files: buildScopeFiles(input.eslintFiles.code, selection.scope.path, ['**/*']),
        ignores: [
            ...listNestedScopes(
                scopes.map(({ scope }) => scope.path),
                selection.scope.path,
            ).map((path) => `${escapeGlob(path)}/**`),
            ...selection.view.test_files,
            ...listScriptPaths({ selection }),
        ],
        rules,
    }));
}

/**
 * Choose the plugin imports and names for the module header and the lint blocks.
 *
 * @param base the ESLint context of the scope.
 *
 * @returns the ESLint plugins to load.
 */
function selectPlugins(base: EslintContext): EslintPlugins {
    const { isAll, repositorySettings } = base;
    const parts = base.eslint;
    return {
        ...ESLINT_PLUGIN_IMPORTS,
        ...(isAll ? { perfectionist: ['perfectionist', 'eslint-plugin-perfectionist'] } : {}),
        ...(isAll && repositorySettings.structure.reexports === 'index-only'
            ? { 'barrel-files': ['barrelFiles', 'eslint-plugin-barrel-files'] }
            : {}),
        ...(parts.boundaryBlocks.length > 0 ? { boundaries: ['boundaries', 'eslint-plugin-boundaries'] } : {}),
    };
}

// Base presets use their first block as an object; framework presets preserve their complete block arrays.
function buildBasePresetBlocks(
    presets: EslintPresets,
    sources: readonly (readonly [string, string])[],
    codeFiles: string[],
): Parameters<BlockWriter['block']>[] {
    return sources.flatMap(([name, importName]) => {
        const selected = presets[name] as EslintPresets[string];
        const files = name === 'packageJson' ? [PACKAGE_JSON_PATTERN] : codeFiles;
        return buildPresetBlocks(
            { ...selected, blocks: [stripUndefined(selected.blocks[0] as EslintPresets[string]['blocks'][number])] },
            importName,
            (block, _index, source) => {
                const fields = pickPresetFields(block);
                return [
                    stripUndefined({ ...fields, files }),
                    `...${source}`,
                    { expression: `${source}.rules`, rules: fields.rules },
                ];
            },
        );
    });
}

export { selectPlugins, buildBlocksAfterFragments, buildBlocksBeforeFragments };
