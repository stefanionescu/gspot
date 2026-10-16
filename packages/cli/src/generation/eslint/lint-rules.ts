import { isDeepStrictEqual } from 'node:util';
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
    ENVIRONMENT_LANGUAGES,
    TRIVIAL_FUNCTIONS_RULE,
    TRIVIAL_FUNCTION_LIMIT,
    DEFAULT_TRIVIAL_FUNCTION_LIMIT,
} from '#cli/config/generation/eslint.ts';

/**
 * Build option declarations and ordered path overrides, each restricted to its project.
 *
 * @param settings the repository settings.
 *
 * @returns one option block per scope and path override, in application order.
 */
function buildRuleOptions(settings: Settings): EslintRuleOptions[] {
    const tables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scope ?? '', second.scope ?? ''),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scope = '', table }) =>
        table.tools?.['eslint'] === undefined ? [] : [{ scope, settings: table.tools['eslint'] }],
    );
    const base = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined ? [] : [{ scope, ...splitGlobSelectors(['**/*']), rules: settings.rules }],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined ? [] : [{ scope, ...splitGlobSelectors(paths), rules }],
        ),
    );
    return [...base, ...overrides];
}

/**
 * Apply accepted findings after generated defaults and option declarations.
 *
 * @param settings the repository settings.
 *
 * @returns explicit rule ignores with their path selectors.
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
 * The blocks that turn off reasoned manifest exclusions after structural defaults and before your own settings.
 *
 * @param scopes the selected configurations and their owning scopes.
 *
 * @returns rule blocks that exclude every nested scope.
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

/**
 * Calculate ESLint limit options directly from the settings.
 *
 * @param view the configured ESLint limits and tool options.
 * @param view.limit the configured numeric limit reader.
 * @param view.options the reader for each tool’s configured options.
 * @param selectors the rule selectors and their paths.
 *
 * @returns the rules selected at this level.
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
            'max-lines': [
                'error',
                { max: limit('file_lines', 'typescript'), skipBlankLines: true, skipComments: true },
            ],
            'max-lines-per-function': [
                'error',
                { max: limit('function_lines', 'typescript'), skipBlankLines: true, skipComments: true, IIFEs: true },
            ],
            'max-params': ['error', { max: limit('function_parameters', 'typescript'), countVoidThis: false }],
            'max-depth': ['error', limit('block_nesting', 'typescript')],
            'max-statements': ['error', limit('function_statements', 'typescript')],
            'max-nested-callbacks': ['error', limit('callback_nesting', 'typescript')],
            complexity: ['error', limit('cyclomatic_complexity', 'typescript')],
            'sonarjs/cognitive-complexity': ['error', limit('cognitive_complexity', 'typescript')],
            'sonarjs/no-identical-functions': ['error', options('duplication').min_lines],
        },
        javascript: {
            'max-params': ['error', limit('function_parameters', 'javascript')],
        },
        node: { ...NODE_RULES, ...ALL_LEVEL_RULES.node },
        console: ALL_LEVEL_RULES.console,
    };
}

/**
 * Apply your accepted findings and options separately to code and package metadata files.
 *
 * @param base the initial check result.
 *
 * @returns the emitted rule blocks with resolved file selectors.
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
 * Find the nearest enclosing selected scope.
 *
 * @param scopes the selected project scopes.
 * @param path the repository-relative destination.
 *
 * @returns the enclosing selection, or undefined at the root.
 */
function findParentSelection(scopes: ScopeSelection[], path: string): ScopeSelection | undefined {
    return scopes
        .filter(({ scope }) => scope.path !== path && isInScope(path, scope.path))
        .toSorted((left, right) => compareScopeDepth(left.scope.path, right.scope.path))
        .at(-1);
}

/**
 * Environment restrictions and trivial-code limits for each project.
 *
 * @param input the selected scopes, structural settings, and detected Node file paths.
 *
 * @returns environment and structural rules at all, otherwise no blocks.
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
            !isDeepStrictEqual(selection.view.roles.environment_readers, parent.view.roles.environment_readers)
        );
    });
    return environmentScopes.flatMap((selection) => {
        const owners = selection.view.roles.environment_readers;
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
 * Calculate changed trivial-code limits for each selected project.
 *
 * @param input the source values.
 *
 * @returns the lint rules that detect unnecessary forwarding functions.
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
};
