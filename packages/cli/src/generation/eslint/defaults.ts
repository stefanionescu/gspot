import { compact } from '#cli/objects.ts';
import { literalGlob } from '#cli/repository/selectors.ts';
import { scopeFiles } from '#cli/generation/eslint/files.ts';
import { levelRules } from '#cli/generation/eslint/blocks.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { presetBlock } from '#cli/generation/eslint/presets.ts';
import { presetSource } from '#cli/generation/eslint/serialize.ts';
import { TEST_RULES, SCRIPT_RULES, BASE_SELECTORS, JAVASCRIPT_RULES } from '#cli/config/generation/eslint-rules.ts';

import {
    CODE_PRESETS,
    FILE_PRESETS,
    PACKAGE_JSON_PATTERN,
    ESLINT_PLUGIN_IMPORTS,
} from '#cli/config/generation/eslint.ts';
import type {
    EslintModule,
    EslintPlugins,
    EslintPresets,
    SelectorGroup,
    EslintRuleLevels,
    EslintFragmentInputs,
} from '#cli/types/generation/eslint.ts';

function presetBlocks(
    presets: EslintPresets,
    sources: readonly (readonly [string, string])[],
    codeFiles: string[],
): Parameters<EslintModule['block']>[] {
    return sources.map(([name, variable]) => {
        const selected = presets[name] as EslintPresets[string];
        const preset = presetBlock(selected.blocks[0] as EslintPresets[string]['blocks'][number]);
        const files = name === 'packageJson' ? [PACKAGE_JSON_PATTERN] : codeFiles;
        const source = presetSource(variable, selected.source);
        return [compact({ ...preset, files }), `...${source}`, { expression: `${source}.rules`, rules: preset.rules }];
    });
}

/**
 * Default code rules, pinned presets, and project settings preceding fragment blocks.
 *
 * @param base the initial check result.
 * @param view the resolved scope settings.
 * @param pluginLevels the ESLint plugin rule levels.
 * @param plugins the selected formatter plugins.
 *
 * @returns the blocks for source syntax and code rules.
 */
export function codeBlocks(
    base: EslintFragmentInputs,
    view: Pick<ScopeView, 'limit'>,
    pluginLevels: EslintRuleLevels,
    plugins: EslintPlugins,
): Parameters<EslintModule['block']>[] {
    const { eslintFiles, isAll, json } = base;
    const config = base.eslint();
    const rules = levelRules(view, isAll ? BASE_SELECTORS : []);
    const pluginMap = Object.entries(plugins)
        .map(([name, [binding]]) => `${JSON.stringify(name)}: ${binding}`)
        .join(', ');
    const pluginRules = Object.fromEntries(
        Object.entries(pluginLevels)
            .filter(([, level]) => level === 'recommended' || (isAll && level === 'all'))
            .map(([rule]) => [`gspot/${rule}`, 'error']),
    );
    const projectBlocks: Parameters<EslintModule['block']>[] = [
        ...config.importStyleBlocks,
        ...config.scopeBlocks,
        ...config.boundaryBlocks,
    ].map(({ settings, ...data }) => {
        if (settings === undefined) return [data, ''];
        const runtime =
            settings['boundaries/files'] === undefined
                ? `settings: ${json(settings)}`
                : `settings: { ...${json(settings)}, 'import/resolver': { typescript: { project: ${json(config.projects)}.map((project) => join(root, project)) } } }`;
        return [data, runtime];
    });
    return [
        ...presetBlocks(base.eslintPresets('javascript'), CODE_PRESETS, eslintFiles.code),
        [
            { files: eslintFiles.code, rules: { ...rules.code, ...pluginRules, ...config.allLevelRules } },
            `plugins: { ${pluginMap} }, linterOptions: { reportUnusedDisableDirectives: 'error' }, languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.es2024 }, settings: { gspot: { root }${config.boundaryBlocks.length > 0 ? ", 'boundaries/root-path': root" : ''} }`,
        ],
        [{ files: eslintFiles.javascript, rules: JAVASCRIPT_RULES }],
        ...projectBlocks,
        ...(config.restrictedImports.length === 0
            ? []
            : ([
                  [
                      {
                          files: eslintFiles.code,
                          rules: { 'no-restricted-imports': ['error', { paths: config.restrictedImports }] },
                      },
                  ],
              ] satisfies Parameters<EslintModule['block']>[])),
    ];
}

/**
 * Runtime, selector, test, script and final pinned rules following fragment blocks.
 *
 * @param base the initial check result.
 * @param view the resolved scope settings.
 * @param fragmentSelectors the selectors contributed by configuration fragments.
 *
 * @returns the blocks for package and file conventions.
 */
export function fileBlocks(
    base: EslintFragmentInputs,
    view: Pick<ScopeView, 'limit'>,
    fragmentSelectors: SelectorGroup[],
): Parameters<EslintModule['block']>[] {
    const { eslintFiles, isAll, json } = base;
    const config = base.eslint();
    const selectors = isAll ? BASE_SELECTORS : [];
    const rules = levelRules(view, selectors);
    const runtimes: Parameters<EslintModule['block']>[] = config.runtimes.map(({ runtime }, index) => {
        const isNode = ['node', 'nodeBuiltin', 'commonjs'].includes(runtime);
        let names = runtime;
        if (runtime === 'node') names = 'nodeBuiltin';
        if (runtime === 'commonjs') names = 'node';
        return [
            {
                files: eslintFiles.code.map((pattern) => [
                    pattern,
                    { runtime: { declarations: config.runtimes, index } },
                ]),
                rules: {
                    ...(isNode ? rules.node : {}),
                    ...(runtime === 'commonjs' ? { 'unicorn/prefer-module': 'off' } : {}),
                },
            },
            `languageOptions: { sourceType: ${json(runtime === 'commonjs' ? 'commonjs' : 'module')}, globals: globals[${json(names)}] }`,
        ];
    });
    return [
        ...runtimes,
        ...fragmentSelectors.map(
            (group): Parameters<EslintModule['block']> => [
                {
                    files: scopeFiles(eslintFiles.code, group.scope ?? '', group.files ?? ['**/*']),
                    ignores: [
                        ...(group.ignoredScopes ?? []).map((scope) => `${literalGlob(scope)}/**`),
                        ...(group.ignores ?? []),
                    ],
                    rules: { 'no-restricted-syntax': ['error', ...selectors, ...group.selectors] },
                },
            ],
        ),
        [{ files: eslintFiles.code, ignores: [...config.testFiles, ...config.scriptFiles], rules: rules.console }],
        [{ files: eslintFiles.scripts, rules: SCRIPT_RULES }],
        [{ files: eslintFiles.tests, rules: TEST_RULES }],
        ...presetBlocks(base.eslintPresets('javascript'), FILE_PRESETS, eslintFiles.code),
        [
            {
                files: [PACKAGE_JSON_PATTERN],
                rules: { 'package-json/restrict-dependency-ranges': ['error', { rangeType: 'pin' }] },
            },
        ],
        [{ files: eslintFiles.javascript, rules: rules.javascript }],
    ];
}

/**
 * Choose the plugin imports and registration names used by both module emission and code blocks.
 *
 * @param base the initial check result.
 *
 * @returns the ESLint plugin declarations required by this configuration.
 */
export function eslintPlugins(base: EslintFragmentInputs): EslintPlugins {
    const { isAll, repositorySettings } = base;
    const config = base.eslint();
    return {
        ...ESLINT_PLUGIN_IMPORTS,
        ...(isAll ? { perfectionist: ['perfectionist', 'eslint-plugin-perfectionist'] } : {}),
        ...(isAll && repositorySettings.structure.reexports === 'index-only'
            ? { 'barrel-files': ['barrelFiles', 'eslint-plugin-barrel-files'] }
            : {}),
        ...(config.boundaryBlocks.length > 0 ? { boundaries: ['boundaries', 'eslint-plugin-boundaries'] } : {}),
    };
}
