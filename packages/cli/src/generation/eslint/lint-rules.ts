import { isDeepStrictEqual } from 'node:util';
import { isRecord } from '#cli/system/values.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { listActiveIgnores } from '#cli/settings/scope-view.ts';
import { isInScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import { BASE_RULES, NODE_RULES, ALL_LEVEL_RULES } from '#cli/config/generation/eslint-rules.ts';
import { type Settings, type ScopeView, type ScopeSelection } from '#cli/types/settings/values.ts';

import {
    buildScopeFiles,
    buildNodePatterns,
    splitGlobSelectors,
    buildSourcePattern,
} from '#cli/generation/eslint/files.ts';
import {
    type SelectorGroup,
    type EslintContext,
    type EslintRuleBlock,
    type EslintLevelRules,
    type EslintRuleOptions,
    type EslintSettingsBlock,
    type ScopeEslintSettings,
} from '#cli/types/generation/eslint.ts';
import {
    ESLINT_CHECK,
    TYPED_LANGUAGES,
    ENVIRONMENT_RULES,
    TRIVIAL_FILES_RULE,
    PACKAGE_JSON_PATTERN,
    ESLINT_SETTINGS_TABLE,
    ENVIRONMENT_LANGUAGES,
    TRIVIAL_FUNCTIONS_RULE,
    TRIVIAL_FUNCTION_LIMIT,
    RESTRICTED_IMPORT_RULES,
    DEFAULT_TRIVIAL_FUNCTION_LIMIT,
} from '#cli/config/generation/eslint.ts';

// ESLint replaces the options of a rule in each later block, so an option list of no-restricted-imports keeps the
// bans of tools.eslint.restricted_imports in the same scope.
function addRestrictedImports(options: unknown[], restricted: unknown[]): unknown[] {
    const [first, ...rest] = options;
    if (rest.length > 0 || !isRecord(first) || Object.hasOwn(first, 'name')) return [...restricted, ...options];
    const paths: unknown = first['paths'];
    return [{ ...first, paths: [...restricted, ...(Array.isArray(paths) ? (paths as unknown[]) : [])] }];
}

function mergeRestrictedImports(rules: EslintRuleOptions['rules'], restricted: unknown[]): EslintRuleOptions['rules'] {
    if (restricted.length === 0) return rules;
    return Object.fromEntries(
        Object.entries(rules).map(([rule, options]) => [
            rule,
            RESTRICTED_IMPORT_RULES.has(rule) && options.length > 0
                ? addRestrictedImports(options, restricted)
                : options,
        ]),
    );
}

/**
 * Build the lint rule options and the path overrides in order, each for its own project.
 *
 * @param settings the parsed gspot.toml.
 * @param scopes every project, whose restricted imports join its own no-restricted-imports options.
 *
 * @returns one option block per scope and path override, in the order they apply.
 */
function buildRuleOptions(settings: Settings, scopes: ScopeSelection[]): EslintRuleOptions[] {
    const tables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scope ?? '', second.scope ?? ''),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scope = '', table }) =>
        table.tools?.['eslint'] === undefined ? [] : [{ scope, settings: table.tools['eslint'] }],
    );
    const restrictedFor = (scope: string): unknown[] =>
        scopes.find((selection) => selection.scope.path === scope)?.view.options(ESLINT_SETTINGS_TABLE)
            .restricted_imports ?? [];
    const base = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined
            ? []
            : [
                  {
                      scope,
                      ...splitGlobSelectors(['**/*']),
                      rules: mergeRestrictedImports(settings.rules, restrictedFor(scope)),
                  },
              ],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined
                ? []
                : [{ scope, ...splitGlobSelectors(paths), rules: mergeRestrictedImports(rules, restrictedFor(scope)) }],
        ),
    );
    return [...base, ...overrides];
}

/**
 * Build the ignore blocks that follow the generated defaults and options.
 *
 * @param settings the parsed gspot.toml.
 *
 * @returns the lint rule ignores with their path selectors.
 */
function buildIgnoreBlocks(settings: Settings): EslintRuleBlock[] {
    return listActiveIgnores(settings).flatMap((entry): EslintRuleBlock[] =>
        entry.rule === undefined || entry.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...splitGlobSelectors(
                          entry.paths === undefined || entry.paths.length === 0 ? ['**/*'] : entry.paths,
                      ),
                      rules: { [entry.rule]: 'off' },
                  },
              ],
    );
}

/**
 * Build the blocks that turn off the lint rules that a manifest excludes with a reason.
 * They follow the structure defaults and come before your own settings.
 *
 * @param scopes every project and its configurations.
 *
 * @returns lint blocks that leave out every nested scope.
 */
function buildRulesOffBlocks(scopes: ScopeSelection[]): EslintRuleBlock[] {
    return scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        const children = listNestedScopes(
            scopes.map((entry) => entry.scope.path),
            scope,
        );
        const excluded = children.map((path) => `!${escapeGlob(path)}/**`);
        return selection.selected
            .flatMap((manifest) => manifest.eslint.rules_off)
            .map(({ files, rules }) => ({
                scope,
                ...splitGlobSelectors([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            }));
    });
}

// The size and complexity rules with the limits of one language.
function buildLimitRules(limit: ScopeView['limit'], language: 'typescript' | 'javascript'): Record<string, unknown> {
    return {
        'max-lines': ['error', { max: limit('file_lines', language), skipBlankLines: true, skipComments: true }],
        'max-lines-per-function': [
            'error',
            { max: limit('function_lines', language), skipBlankLines: true, skipComments: true, IIFEs: true },
        ],
        'max-params': ['error', { max: limit('function_parameters', language), countVoidThis: false }],
        'max-depth': ['error', limit('block_nesting', language)],
        'max-statements': ['error', limit('function_statements', language)],
        'max-nested-callbacks': ['error', limit('callback_nesting', language)],
        complexity: ['error', limit('cyclomatic_complexity', language)],
        'sonarjs/cognitive-complexity': ['error', limit('cognitive_complexity', language)],
    };
}

/**
 * Calculate the ESLint limit options from the settings. JavaScript files get the JavaScript limits in their own
 * block, which comes after the block for every code file.
 *
 * @param view the settings that the limits read.
 * @param view.limit reads one numeric setting.
 * @param view.options reads the extra settings of a tool.
 * @param selectors the syntax patterns and their paths.
 *
 * @returns the lint rules at this level.
 */
function buildLevelRules(
    view: Pick<ScopeView, 'limit' | 'options'>,
    selectors: Readonly<SelectorGroup['selectors']>,
): EslintLevelRules {
    const { limit, options } = view;
    return {
        code: {
            ...BASE_RULES,
            ...ALL_LEVEL_RULES.code,
            'no-restricted-syntax': ['error', ...selectors],
            ...buildLimitRules(limit, 'typescript'),
            'sonarjs/no-identical-functions': ['error', options('duplication').min_lines],
        },
        javascript: buildLimitRules(limit, 'javascript'),
        node: { ...NODE_RULES, ...ALL_LEVEL_RULES.node },
        console: ALL_LEVEL_RULES.console,
    };
}

/**
 * Build your ignore and option blocks. Code files and package metadata files stay apart.
 *
 * @param base the settings blocks and the ESLint file sets.
 *
 * @returns the lint blocks with resolved file selectors.
 */
function buildSelectedBlocks(base: Pick<EslintContext, 'settingsBlocks' | 'eslintFiles'>): EslintSettingsBlock[] {
    const result: EslintSettingsBlock[] = [];
    for (const { scope, includes, excludes, rules } of base.settingsBlocks) {
        const entries = Object.entries(rules);
        for (const block of [
            {
                files: buildScopeFiles(base.eslintFiles.code, scope, includes),
                ignores: excludes,
                rules: Object.fromEntries(entries.filter(([name]) => !name.startsWith('package-json/'))),
            },
            {
                files: buildScopeFiles([PACKAGE_JSON_PATTERN], scope, includes),
                ignores: excludes,
                rules: Object.fromEntries(entries.filter(([name]) => name.startsWith('package-json/'))),
            },
        ]) {
            if (Object.keys(block.rules).length === 0) continue;

            result.push(block);
        }
    }
    return result;
}

/**
 * Find the nearest scope that holds a path.
 *
 * @param scopes every project selection.
 * @param path the repository-relative destination.
 *
 * @returns the scope, or undefined at the root.
 */
function findParentSelection(scopes: ScopeSelection[], path: string): ScopeSelection | undefined {
    return scopes
        .filter(({ scope }) => scope.path !== path && isInScope(path, scope.path))
        .toSorted((left, right) => compareScopeDepth(left.scope.path, right.scope.path))
        .at(-1);
}

/**
 * Build import restrictions where a scope changes the list inherited from its parent.
 *
 * @param input every scope and the code selectors of the generated file.
 * @returns one block per changed list, excluding scopes with their own lists.
 */
function buildRestrictedImportBlocks(input: Pick<EslintContext, 'scopes' | 'eslintFiles'>): EslintSettingsBlock[] {
    const scopes = input.scopes.filter(({ view }) => view.configurations.includes('javascript'));
    const restrictedScopes = scopes.filter((selection) => {
        const parent = findParentSelection(scopes, selection.scope.path);
        return !isDeepStrictEqual(
            selection.view.options(ESLINT_SETTINGS_TABLE).restricted_imports,
            parent?.view.options(ESLINT_SETTINGS_TABLE).restricted_imports ?? [],
        );
    });
    return restrictedScopes.map((selection) => ({
        files: buildScopeFiles(input.eslintFiles.code, selection.scope.path, ['**/*']),
        ignores: listNestedScopes(
            restrictedScopes.map(({ scope }) => scope.path),
            selection.scope.path,
        ).map((path) => `${escapeGlob(path)}/**`),
        rules: {
            'no-restricted-imports': [
                'error',
                { paths: selection.view.options(ESLINT_SETTINGS_TABLE).restricted_imports },
            ],
        },
    }));
}

/**
 * Build the environment-variable rule blocks for each project with its own environment readers.
 *
 * @param input what the lint rules cover.
 *
 * @returns the lint blocks at level all, or none.
 */
function buildEnvironmentRuleBlocks(
    input: Pick<EslintContext, 'scopes' | 'repositorySettings' | 'nodeFiles'>,
): EslintRuleBlock[] {
    const { scopes, repositorySettings: settings, nodeFiles } = input;
    if (settings.level !== 'all') return [];
    const environmentScopes = scopes.filter((selection) => {
        const parent = findParentSelection(scopes, selection.scope.path);
        return (
            parent === undefined ||
            !isDeepStrictEqual(
                selection.view.values.structure?.environment_readers,
                parent.view.values.structure?.environment_readers,
            )
        );
    });
    return environmentScopes.flatMap((selection) => {
        const owners = selection.view.values.structure?.environment_readers ?? [];
        return owners.length === 0
            ? []
            : [
                  {
                      scope: selection.scope.path,
                      ...splitGlobSelectors([
                          buildSourcePattern(...ENVIRONMENT_LANGUAGES),
                          ...buildNodePatterns(nodeFiles, selection.scope.path),
                          ...owners.map((path) => `!${path}`),
                          ...listNestedScopes(
                              environmentScopes.map(({ scope }) => scope.path),
                              selection.scope.path,
                          ).map((path) => `!${escapeGlob(path)}/**`),
                      ]),
                      rules: ENVIRONMENT_RULES,
                  },
              ];
    });
}

/**
 * Calculate the trivial-code limits for each project.
 *
 * @param input what the limits cover.
 *
 * @returns the lint rules that detect needless forwarding functions.
 */
function buildTrivialRuleBlocks(
    input: Pick<EslintContext, 'scopes' | 'repositorySettings' | 'nodeFiles'>,
): EslintRuleBlock[] {
    const { scopes, repositorySettings: settings, nodeFiles } = input;
    if (settings.level !== 'all') return [];
    const blocks: EslintRuleBlock[] = [];
    const allowIndex = settings.structure.reexports === 'index-only';
    for (const selection of scopes.toSorted((a, b) => compareScopeDepth(a.scope.path, b.scope.path))) {
        const parent = findParentSelection(scopes, selection.scope.path);
        const limits = ['javascript', 'typescript']
            .map((language) => ({
                language,
                value: selection.view.limit(TRIVIAL_FUNCTION_LIMIT, language),
            }))
            .filter(({ language, value }) =>
                selection.scope.path === ''
                    ? value !== DEFAULT_TRIVIAL_FUNCTION_LIMIT || allowIndex
                    : value !==
                      (parent?.view.limit(TRIVIAL_FUNCTION_LIMIT, language) ?? DEFAULT_TRIVIAL_FUNCTION_LIMIT),
            );
        const groups = new Map<number, string[]>();
        for (const { language, value } of limits) groups.set(value, [...(groups.get(value) ?? []), language]);
        for (const [trivialStatements, languages] of groups) {
            const patterns = languages.flatMap((language) =>
                language === 'javascript'
                    ? [buildSourcePattern('javascript'), ...buildNodePatterns(nodeFiles, selection.scope.path)]
                    : [buildSourcePattern(...TYPED_LANGUAGES)],
            );
            blocks.push({
                scope: selection.scope.path,
                ...splitGlobSelectors(patterns),
                rules: {
                    [TRIVIAL_FILES_RULE]: ['error', { trivialStatements, allowIndex }],
                    [TRIVIAL_FUNCTIONS_RULE]: ['error', { trivialStatements }],
                },
            });
        }
    }
    return blocks;
}

export {
    buildLevelRules,
    buildRuleOptions,
    buildIgnoreBlocks,
    buildRulesOffBlocks,
    buildSelectedBlocks,
    findParentSelection,
    buildTrivialRuleBlocks,
    buildEnvironmentRuleBlocks,
    buildRestrictedImportBlocks,
};
