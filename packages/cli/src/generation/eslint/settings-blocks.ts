import { isDeepStrictEqual } from 'node:util';
import { isRecord } from '#cli/system/tables.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { CODE_LANGUAGES } from '#cli/config/generation/eslint/files.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { PACKAGE_JSON_PATTERN } from '#cli/config/generation/eslint/base.ts';
import { getTable, getLimit, findParentSelection } from '#cli/settings/scope-view.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/eslint/tool-settings.ts';

import {
    splitGlobs,
    buildScopeFiles,
    buildNodePatterns,
    buildSourcePattern,
    listNestedScopeGlobs,
} from '#cli/generation/eslint/files.ts';
import type {
    EslintRuleBlock,
    PlannedEslintFile,
    EslintRuleOptions,
    EslintBlockFields,
    ScopeEslintSettings,
} from '#cli/types/generation/eslint.ts';
import {
    ESLINT_CHECK,
    TYPED_LANGUAGES,
    ENVIRONMENT_RULES,
    TRIVIAL_FILES_RULE,
    ENVIRONMENT_LANGUAGES,
    TRIVIAL_FUNCTIONS_RULE,
    TRIVIAL_FUNCTION_LIMIT,
    RESTRICTED_IMPORT_RULES,
} from '#cli/config/generation/eslint/settings-blocks.ts';

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
export function buildRuleOptions(settings: Settings, scopes: Scope[]): EslintRuleOptions[] {
    const selections = new Map(scopes.map((selection) => [selection.scope.path, selection]));
    const tables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scope ?? '', second.scope ?? ''),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scope = '', table }) =>
        table.tools?.['eslint'] === undefined ? [] : [{ scope, settings: table.tools['eslint'] }],
    );
    const restrictedFor = (scope: string): unknown[] => {
        const selection = selections.get(scope);
        if (selection === undefined)
            throw new Error(`No scope selection for ESLint rule options at ${JSON.stringify(scope)}.`);
        return getTable(selection.view, ESLINT_SETTINGS_TABLE).restricted_imports;
    };
    const context = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined
            ? []
            : [
                  {
                      scope,
                      ...splitGlobs(['**/*']),
                      rules: mergeRestrictedImports(settings.rules, restrictedFor(scope)),
                  },
              ],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined
                ? []
                : [{ scope, ...splitGlobs(paths), rules: mergeRestrictedImports(rules, restrictedFor(scope)) }],
        ),
    );
    return [...context, ...overrides];
}

/**
 * Build the ignore blocks that follow the generated defaults and options.
 *
 * @param settings the parsed gspot.toml.
 *
 * @returns the lint rule ignores with their path selectors.
 */
export function buildIgnoreBlocks(settings: Settings): EslintRuleBlock[] {
    return settings.ignore.flatMap((entry): EslintRuleBlock[] =>
        entry.rule === undefined || entry.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...splitGlobs(entry.paths === undefined || entry.paths.length === 0 ? ['**/*'] : entry.paths),
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
export function buildRulesOffBlocks(scopes: Scope[]): EslintRuleBlock[] {
    return scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        const excluded = listNestedScopeGlobs(
            scopes.map((entry) => entry.scope.path),
            scope,
        ).map((path) => `!${path}`);
        return selection.selected
            .flatMap((configuration) => configuration.eslint.rules_off)
            .map(({ files, rules }) => ({
                scope,
                ...splitGlobs([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            }));
    });
}

/**
 * Build your ignore and option blocks. Code files and package metadata files stay apart.
 *
 * @param planned the settings blocks and the ESLint file sets.
 *
 * @returns the lint blocks with resolved file selectors.
 */
export function buildSelectedBlocks(
    planned: Pick<PlannedEslintFile, 'settingsBlocks' | 'eslintFiles'>,
): EslintBlockFields[] {
    const result: EslintBlockFields[] = [];
    for (const { scope, includes, excludes, rules } of planned.settingsBlocks) {
        const entries = Object.entries(rules);
        for (const block of [
            {
                files: buildScopeFiles(planned.eslintFiles.code, scope, includes),
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
 * Build import restrictions where a scope changes the list inherited from its parent.
 *
 * @param planned every scope and the code selectors of the generated file.
 * @returns one block per changed list, excluding scopes with their own lists.
 */
export function buildRestrictedImportBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>,
): EslintBlockFields[] {
    const scopes = planned.session.scopes.filter(({ view }) => view.configurations.includes(JAVASCRIPT_CONFIGURATION));
    const restrictedScopes = scopes.filter((selection) => {
        const parent = findParentSelection(scopes, selection.scope.path);
        return !isDeepStrictEqual(
            getTable(selection.view, ESLINT_SETTINGS_TABLE).restricted_imports,
            parent === undefined ? [] : getTable(parent.view, ESLINT_SETTINGS_TABLE).restricted_imports,
        );
    });
    return restrictedScopes.map((selection) => ({
        files: buildScopeFiles(planned.eslintFiles.code, selection.scope.path, ['**/*']),
        ignores: listNestedScopeGlobs(
            restrictedScopes.map(({ scope }) => scope.path),
            selection.scope.path,
        ),
        rules: {
            'no-restricted-imports': [
                'error',
                { paths: getTable(selection.view, ESLINT_SETTINGS_TABLE).restricted_imports },
            ],
        },
    }));
}

/**
 * Build the environment-variable rule blocks for each project with its own environment readers.
 *
 * @param planned what the lint rules cover.
 *
 * @returns the lint blocks at level all, or none.
 */
export function buildEnvironmentRuleBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>,
): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settingsFile.settings.level !== 'all') return [];
    const { scopes } = session;
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
                      ...splitGlobs([
                          buildSourcePattern(...ENVIRONMENT_LANGUAGES),
                          ...buildNodePatterns(nodeFiles, selection.scope.path),
                          ...owners.map((path) => `!${path}`),
                          ...listNestedScopeGlobs(
                              environmentScopes.map(({ scope }) => scope.path),
                              selection.scope.path,
                          ).map((path) => `!${path}`),
                      ]),
                      rules: ENVIRONMENT_RULES,
                  },
              ];
    });
}

/**
 * Calculate the trivial-code limits for each project.
 *
 * @param planned what the limits cover.
 *
 * @returns the lint rules that detect needless forwarding functions.
 */
export function buildTrivialRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settingsFile.settings.level !== 'all') return [];
    const { scopes } = session;
    const blocks: EslintRuleBlock[] = [];
    const allowIndex = session.settingsFile.settings.structure.reexports === 'index-only';
    for (const selection of scopes.toSorted((a, b) => compareScopeDepth(a.scope.path, b.scope.path))) {
        const parent = findParentSelection(scopes, selection.scope.path);
        const limits = CODE_LANGUAGES.map((language) => ({
            language,
            value: getLimit(selection.view, TRIVIAL_FUNCTION_LIMIT, language),
        })).filter(
            ({ language, value }) =>
                parent === undefined || value !== getLimit(parent.view, TRIVIAL_FUNCTION_LIMIT, language),
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
                ...splitGlobs(patterns),
                rules: {
                    [TRIVIAL_FILES_RULE]: ['error', { trivialStatements, allowIndex }],
                    [TRIVIAL_FUNCTIONS_RULE]: ['error', { trivialStatements }],
                },
            });
        }
    }
    return blocks;
}
