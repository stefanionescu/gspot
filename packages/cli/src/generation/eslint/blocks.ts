import { everyTable } from '#cli/settings/inherit.ts';
import { activeIgnores } from '#cli/settings/view.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { parentSelection } from '#cli/generation/eslint/structure.ts';
import { listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Settings, ScopeView, ScopeSelection } from '#cli/types/settings/values.ts';
import { BASE_RULES, NODE_RULES, ALL_LEVEL_RULES } from '#cli/config/generation/eslint-rules.ts';
import { scopeFiles, nodePatterns, globSelectors, sourcePattern } from '#cli/generation/eslint/files.ts';

import {
    ESLINT_CHECK,
    CODE_LANGUAGES,
    IMPORT_EXTENSIONS,
    FILE_EXTENSION_RULE,
    PACKAGE_JSON_PATTERN,
    ESLINT_SETTINGS_TABLE,
    TYPESCRIPT_EXTENSION_MAP,
} from '#cli/config/generation/eslint.ts';
import type {
    EslintBlock,
    SelectorGroup,
    EslintRuleBlock,
    EslintLevelRules,
    EslintRuleOptions,
    EslintSettingsBlock,
    ScopeEslintSettings,
    EslintFragmentInputs,
} from '#cli/types/generation/eslint.ts';

/**
 * Build option declarations and ordered path overrides, each restricted to its project.
 *
 * @param settings the repository settings.
 *
 * @returns one option block per scope and path override, in application order.
 */
export function ruleOptions(settings: Settings): EslintRuleOptions[] {
    const tables = everyTable(settings).toSorted((first, second) =>
        compareScopeDepth(first.scope ?? '', second.scope ?? ''),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scope = '', table }) =>
        table.tools?.['eslint'] === undefined ? [] : [{ scope, settings: table.tools['eslint'] }],
    );
    const base = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined ? [] : [{ scope, ...globSelectors(['**/*']), rules: settings.rules }],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined ? [] : [{ scope, ...globSelectors(paths), rules }],
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
export function ignoreBlocks(settings: Settings): EslintRuleBlock[] {
    return activeIgnores(settings).flatMap((entry): EslintRuleBlock[] =>
        entry.rule === undefined || entry.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...globSelectors(entry.paths === undefined || entry.paths.length === 0 ? ['**/*'] : entry.paths),
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
export function manifestRuleBlocks(scopes: ScopeSelection[]): EslintRuleBlock[] {
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
                ...globSelectors([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            }));
    });
}

/**
 * Build relative-import rules for each selected project and path style.
 *
 * @param scopes selected projects and their import styles.
 * @param nodeFiles your own files selected for Node.js execution.
 *
 * @returns rule and TypeScript-extension settings restricted to each project.
 */
export function importStyleBlocks(scopes: ScopeSelection[], nodeFiles: string[]): EslintBlock[] {
    const changed = scopes.filter((entry) => {
        const parent = parentSelection(scopes, entry.scope.path);
        return (
            entry.view.values[ESLINT_SETTINGS_TABLE]?.import_extension !==
            parent?.view.values[ESLINT_SETTINGS_TABLE]?.import_extension
        );
    });
    return changed.flatMap((entry) => {
        const path = entry.scope.path;
        const children = listNestedScopes(
            changed.map(({ scope }) => scope.path),
            path,
        );
        const styles = entry.view.values[ESLINT_SETTINGS_TABLE]?.import_extension;
        return styles === undefined
            ? []
            : [
                  {
                      files: [sourcePattern(...CODE_LANGUAGES), ...nodePatterns(nodeFiles, path)].map((pattern) => [
                          path === '' ? '**/*' : `${escapeGlob(path)}/**/*`,
                          pattern,
                      ]),
                      ignores: children.map((child) => `${escapeGlob(child)}/**`),
                      settings: {
                          n: {
                              tryExtensions: IMPORT_EXTENSIONS,
                              typescriptExtensionMap: styles === 'js' ? TYPESCRIPT_EXTENSION_MAP : [],
                          },
                      },
                      rules: { [FILE_EXTENSION_RULE]: ['error', styles === 'extensionless' ? 'never' : 'always'] },
                  },
              ];
    });
}

/**
 * Calculate ESLint limit options directly from the settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.limit the configured numeric limit reader.
 * @param selectors the rule selectors and their paths.
 *
 * @returns the rules selected at this level.
 */
export function levelRules(
    { limit }: Pick<ScopeView, 'limit'>,
    selectors: Readonly<SelectorGroup['selectors']>,
): EslintLevelRules {
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
            'max-depth': ['error', limit('nesting', 'typescript')],
            'max-statements': ['error', limit('statements', 'typescript')],
            'max-nested-callbacks': ['error', limit('callback_nesting', 'typescript')],
            complexity: ['error', limit('cyclomatic_complexity', 'typescript')],
            'sonarjs/cognitive-complexity': ['error', limit('cognitive_complexity', 'typescript')],
            'sonarjs/no-identical-functions': ['error', limit('min_duplicate_lines')],
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
export function appliedBlocks(
    base: Pick<EslintFragmentInputs, 'settingsBlocks' | 'eslintFiles'>,
): EslintSettingsBlock[] {
    const result: EslintSettingsBlock[] = [];
    for (const { scope, includes, excludes, rules } of base.settingsBlocks()) {
        const entries = Object.entries(rules);
        for (const block of [
            {
                files: scopeFiles(base.eslintFiles.code, scope, includes),
                ignores: excludes,
                rules: Object.fromEntries(entries.filter(([name]) => !name.startsWith('package-json/'))),
            },
            {
                files: scopeFiles([PACKAGE_JSON_PATTERN], scope, includes),
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
