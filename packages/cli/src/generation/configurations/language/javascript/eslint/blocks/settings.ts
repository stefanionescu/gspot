import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { getLimit, getTable, findParentScope } from '#cli/settings/scopes.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { buildLimitRuleBlocks } from '#cli/generation/configurations/language/javascript/eslint/blocks/limits.ts';

import type {
    EslintRuleBlock,
    EslintBlockFields,
    EslintRuleOptions,
    PlannedEslintFile,
    ScopeEslintSettings,
} from '#cli/types/generation/eslint.ts';
import {
    ESLINT_CHECK,
    CODE_LANGUAGES,
    PACKAGE_JSON_PATTERN,
    ESLINT_SETTINGS_TABLE,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
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
Build the lint rule options and the path overrides in order, each for its own project.

@param settings the parsed gspot.toml.
@param scopes every project, whose restricted imports join its own no-restricted-imports options.

@returns one option block per scope and path override, in the order they apply.
*/
export function buildRuleOptions(settings: Settings, scopes: Scope[]): EslintRuleOptions[] {
    const scopesByPath = new Map(scopes.map((scope) => [scope.path, scope]));
    const tables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scope ?? '', second.scope ?? ''),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scope = '', table }) => {
        const owner = scopesByPath.get(scope);
        const options = table.tools?.['eslint'];
        return owner === undefined || options === undefined ? [] : { scope: owner, settings: options };
    });
    const scopeOptions = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined
            ? []
            : [
                  {
                      scope: scope.path,
                      ...splitGlobs(['**/*']),
                      rules: mergeRestrictedImports(
                          settings.rules,
                          getTable(scope.settings, ESLINT_SETTINGS_TABLE).restricted_imports,
                      ),
                  },
              ],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined
                ? []
                : {
                      scope: scope.path,
                      ...splitGlobs(paths),
                      rules: mergeRestrictedImports(
                          rules,
                          getTable(scope.settings, ESLINT_SETTINGS_TABLE).restricted_imports,
                      ),
                  },
        ),
    );
    return [...scopeOptions, ...overrides];
}

function buildRulesOffBlocks(scopes: Scope[]): EslintRuleBlock[] {
    return scopes.flatMap((scope) => {
        const scopePath = scope.path;
        const excluded = listNestedScopeGlobs(
            scopes.map((each) => each.path),
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
Build import restrictions where a scope changes the list inherited from its parent.

@param planned every scope and the code selectors of the generated file.
@returns one block per changed list, excluding scopes with their own lists.
*/
export function buildRestrictedImportBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>,
): EslintBlockFields[] {
    const scopes = planned.session.scopes.filter(({ settings }) =>
        settings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    const restrictedScopes = scopes.filter((scope) => {
        const parent = findParentScope(scopes, scope.path);
        return !isDeepStrictEqual(
            getTable(scope.settings, ESLINT_SETTINGS_TABLE).restricted_imports,
            parent === undefined ? [] : getTable(parent.settings, ESLINT_SETTINGS_TABLE).restricted_imports,
        );
    });
    return restrictedScopes.map((scope) => ({
        files: buildScopeFiles(planned.eslintFiles.code, scope.path, ['**/*']),
        ignores: listNestedScopeGlobs(
            restrictedScopes.map(({ path }) => path),
            scope.path,
        ),
        rules: {
            'no-restricted-imports': [
                'error',
                { paths: getTable(scope.settings, ESLINT_SETTINGS_TABLE).restricted_imports },
            ],
        },
    }));
}

function buildEnvironmentRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settingsFile.settings.level !== 'all') return [];
    const { scopes } = session;
    const environmentScopes = scopes.filter((scope) => {
        const parent = findParentScope(scopes, scope.path);
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
            : {
                  scope: scope.path,
                  ...splitGlobs([
                      buildSourcePattern(...ENVIRONMENT_LANGUAGES),
                      ...buildNodePatterns(nodeFiles, scope.path),
                      ...owners.map((path) => `!${path}`),
                      ...listNestedScopeGlobs(
                          environmentScopes.map(({ path }) => path),
                          scope.path,
                      ).map((path) => `!${path}`),
                  ]),
                  rules: ENVIRONMENT_RULES,
              };
    });
}

function buildTrivialRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settingsFile.settings.level !== 'all') return [];
    const { scopes } = session;
    const blocks: EslintRuleBlock[] = [];
    const isAllowIndex = session.settingsFile.settings.structure.reexports === 'index-only';
    const orderedScopes = scopes.toSorted((a, b) => compareScopeDepth(a.path, b.path));
    for (const scope of orderedScopes) {
        const parent = findParentScope(scopes, scope.path);
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
                    ? [buildSourcePattern('javascript'), ...buildNodePatterns(nodeFiles, scope.path)]
                    : buildSourcePattern(...TYPED_LANGUAGES),
            );
            blocks.push({
                scope: scope.path,
                ...splitGlobs(patterns),
                rules: {
                    [TRIVIAL_FILES_RULE]: ['error', { allowIndex: isAllowIndex }],
                    [TRIVIAL_FUNCTIONS_RULE]: ['error', { trivialFunctionStatements }],
                },
            });
        }
    }
    return blocks;
}

function buildSettingsBlocks(planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session } = planned;
    const ignored = session.settingsFile.settings.ignore.flatMap((ignore): EslintRuleBlock[] =>
        ignore.rule === undefined || ignore.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...splitGlobs(ignore.paths === undefined || ignore.paths.length === 0 ? ['**/*'] : ignore.paths),
                      rules: { [ignore.rule]: 'off' },
                  },
              ],
    );
    return [
        ...buildLimitRuleBlocks(planned),
        ...buildEnvironmentRuleBlocks(planned),
        ...buildTrivialRuleBlocks(planned),
        ...buildRulesOffBlocks(session.scopes),
        ...ignored,
    ];
}

/**
Build the settings blocks: limit, environment, trivial-code, turned-off rule, and ignore blocks. Split each into a
block for the code files and a block for the package.json files, and drop the blocks with no rules.

@param planned every scope, the scope that owns the file, your own scripts that run on Node.js, and the ESLint file
sets.
@returns the lint blocks with resolved file selectors.
*/
export function splitSettingsBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles' | 'eslintFiles'>,
): EslintBlockFields[] {
    return buildSettingsBlocks(planned).flatMap(({ scope, includes, excludes, rules }) => {
        const rulePairs = Object.entries(rules);
        return [
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
        ].filter((block) => Object.keys(block.rules).length > 0);
    });
}
