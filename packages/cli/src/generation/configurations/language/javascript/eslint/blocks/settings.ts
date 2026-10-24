import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { getLimit, getTable, findParentScope } from '#cli/settings/scopes.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';

import {
    CODE_LANGUAGES,
    PACKAGE_JSON_PATTERN,
    ESLINT_SETTINGS_TABLE,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import {
    type EslintRuleBlock,
    type EslintBlockFields,
    type EslintRuleOptions,
    type PlannedEslintFile,
    type ScopeEslintSettings,
} from '#cli/types/generation/eslint.ts';
import {
    splitGlobs,
    buildScopeFiles,
    buildNodePatterns,
    buildSourcePattern,
    listNestedScopeGlobs,
} from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import {
    TYPED_LANGUAGES,
    ENVIRONMENT_RULES,
    TRIVIAL_FILES_RULE,
    ENVIRONMENT_LANGUAGES,
    TRIVIAL_FUNCTIONS_RULE,
    TRIVIAL_FUNCTION_LIMIT,
    RESTRICTED_IMPORT_RULES,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/settings.ts';

function addRestrictedImports(options: unknown[], restricted: unknown[]): unknown[] {
    const [first, ...rest] = options;
    if (rest.length > 0 || !isTable(first) || Object.hasOwn(first, 'name')) return [...restricted, ...options];
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
    const tables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scope ?? '', second.scope ?? ''),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scope = '', table }) =>
        table.tools?.['eslint'] === undefined ? [] : [{ scope, settings: table.tools['eslint'] }],
    );
    const eslintScopes = new Set(scopeSettings.map(({ scope }) => scope));
    const restrictedImports = new Map(
        scopes
            .filter((scope) => eslintScopes.has(scope.folder.path))
            .map((scope) => [scope.folder.path, getTable(scope.settings, ESLINT_SETTINGS_TABLE).restricted_imports]),
    );
    const scopeOptions = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined
            ? []
            : [
                  {
                      scope,
                      ...splitGlobs(['**/*']),
                      rules: mergeRestrictedImports(settings.rules, restrictedImports.get(scope) ?? []),
                  },
              ],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined
                ? []
                : [
                      {
                          scope,
                          ...splitGlobs(paths),
                          rules: mergeRestrictedImports(rules, restrictedImports.get(scope) ?? []),
                      },
                  ],
        ),
    );
    return [...scopeOptions, ...overrides];
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
    return scopes.flatMap((scope) => {
        const scopePath = scope.folder.path;
        const excluded = listNestedScopeGlobs(
            scopes.map((each) => each.folder.path),
            scopePath,
        ).map((path) => `!${path}`);
        return scope.configurations
            .flatMap((configuration) => configuration.eslint.rules_off)
            .map(({ files, rules }) => ({
                scope: scopePath,
                ...splitGlobs([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            }));
    });
}

/**
 * Build the settings blocks: environment, trivial-code, turned-off rule, and ignore blocks. Code files and package.json
 * files stay apart.
 *
 * @param planned the settings blocks and the ESLint file sets.
 * @returns the lint blocks with resolved file selectors.
 */
export function buildSelectedBlocks(
    planned: Pick<PlannedEslintFile, 'settingsBlocks' | 'eslintFiles'>,
): EslintBlockFields[] {
    const result: EslintBlockFields[] = [];
    for (const { scope, includes, excludes, rules } of planned.settingsBlocks) {
        const rulePairs = Object.entries(rules);
        for (const block of [
            {
                files: buildScopeFiles(planned.eslintFiles.code, scope, includes),
                ignores: excludes,
                rules: Object.fromEntries(rulePairs.filter(([name]) => !name.startsWith('package-json/'))),
            },
            {
                files: buildScopeFiles([PACKAGE_JSON_PATTERN], scope, includes),
                ignores: excludes,
                rules: Object.fromEntries(rulePairs.filter(([name]) => name.startsWith('package-json/'))),
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
    const scopes = planned.session.scopes.filter(({ settings }) =>
        settings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    const restrictedScopes = scopes.filter((scope) => {
        const parent = findParentScope(scopes, scope.folder.path);
        return !isDeepStrictEqual(
            getTable(scope.settings, ESLINT_SETTINGS_TABLE).restricted_imports,
            parent === undefined ? [] : getTable(parent.settings, ESLINT_SETTINGS_TABLE).restricted_imports,
        );
    });
    return restrictedScopes.map((scope) => ({
        files: buildScopeFiles(planned.eslintFiles.code, scope.folder.path, ['**/*']),
        ignores: listNestedScopeGlobs(
            restrictedScopes.map(({ folder }) => folder.path),
            scope.folder.path,
        ),
        rules: {
            'no-restricted-imports': [
                'error',
                { paths: getTable(scope.settings, ESLINT_SETTINGS_TABLE).restricted_imports },
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
    const environmentScopes = scopes.filter((scope) => {
        const parent = findParentScope(scopes, scope.folder.path);
        return (
            parent === undefined ||
            !isDeepStrictEqual(
                scope.settings.values.structure?.environment_readers,
                parent.settings.values.structure?.environment_readers,
            )
        );
    });
    return environmentScopes.flatMap((scope) => {
        const owners = scope.settings.values.structure?.environment_readers ?? [];
        return owners.length === 0
            ? []
            : [
                  {
                      scope: scope.folder.path,
                      ...splitGlobs([
                          buildSourcePattern(...ENVIRONMENT_LANGUAGES),
                          ...buildNodePatterns(nodeFiles, scope.folder.path),
                          ...owners.map((path) => `!${path}`),
                          ...listNestedScopeGlobs(
                              environmentScopes.map(({ folder }) => folder.path),
                              scope.folder.path,
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
 * @returns the lint rules that detect trivial functions and files that only forward code.
 */
export function buildTrivialRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settingsFile.settings.level !== 'all') return [];
    const { scopes } = session;
    const blocks: EslintRuleBlock[] = [];
    const allowIndex = session.settingsFile.settings.structure.reexports === 'index-only';
    for (const scope of scopes.toSorted((a, b) => compareScopeDepth(a.folder.path, b.folder.path))) {
        const parent = findParentScope(scopes, scope.folder.path);
        const limits = CODE_LANGUAGES.map((language) => ({
            language,
            value: getLimit(scope.settings, TRIVIAL_FUNCTION_LIMIT, language),
        })).filter(
            ({ language, value }) =>
                parent === undefined || value !== getLimit(parent.settings, TRIVIAL_FUNCTION_LIMIT, language),
        );
        const groups = new Map<number, string[]>();
        for (const { language, value } of limits) groups.set(value, [...(groups.get(value) ?? []), language]);
        for (const [trivialFunctionStatements, languages] of groups) {
            const patterns = languages.flatMap((language) =>
                language === 'javascript'
                    ? [buildSourcePattern('javascript'), ...buildNodePatterns(nodeFiles, scope.folder.path)]
                    : [buildSourcePattern(...TYPED_LANGUAGES)],
            );
            blocks.push({
                scope: scope.folder.path,
                ...splitGlobs(patterns),
                rules: {
                    [TRIVIAL_FILES_RULE]: ['error', { allowIndex }],
                    [TRIVIAL_FUNCTIONS_RULE]: ['error', { trivialFunctionStatements }],
                },
            });
        }
    }
    return blocks;
}
