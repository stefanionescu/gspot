import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/system/paths.ts';
import { getRequired } from '#cli/system/tables.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import { getLimit, getTable } from '#cli/settings/scopes.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import { LIMIT_RULES_BY_CHECK } from '#cli/manifests/limits.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { joinScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import { buildLimitRuleBlocks } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';

import type {
    EslintRuleBlock,
    EslintBlockFields,
    EslintRuleOptions,
    PlannedEslintFile,
    ScopeEslintSettings,
} from '#cli/types/configurations/language.ts';
import {
    splitGlobs,
    buildScopeFiles,
    buildNodePatterns,
    buildExtensionGlob,
    buildScopeOverrideBlocks,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import {
    ESLINT_CHECK,
    CODE_LANGUAGES,
    TYPED_LANGUAGES,
    ENVIRONMENT_RULES,
    TRIVIAL_FILES_RULE,
    PACKAGE_JSON_PATTERN,
    ENVIRONMENT_LANGUAGES,
    TRIVIAL_FUNCTIONS_RULE,
    CLIENT_ENVIRONMENT_RULE,
    JAVASCRIPT_CONFIGURATION,
    PACKAGE_JSON_RULE_PREFIX,
} from '#cli/config/configurations/blocks.ts';

function listManifestRuleBlocks(scope: Scope, excluded: string[], dependencyNames: string[]): EslintRuleBlock[] {
    const tables = scope.configurations.map(({ eslint }) => eslint);
    return [
        ...tables
            .flatMap(({ client_environment }) => client_environment)
            .filter(({ dependencies }) => dependencies.every((name) => dependencyNames.includes(name)))
            .map(({ files, public_prefixes, allowed_names }) => ({
                scopePath: scope.path,
                ...splitGlobs([...files.map((file) => joinScopeSelector(file, escapeGlob(scope.path))), ...excluded]),
                rules: {
                    [CLIENT_ENVIRONMENT_RULE]: [
                        'error',
                        {
                            client: true,
                            publicPrefixes: public_prefixes,
                            ...(allowed_names !== undefined && { allowedNames: allowed_names }),
                        },
                    ],
                },
            })),
        ...tables
            .flatMap(({ rules_off }) => rules_off)
            .map(({ files, rules }) => ({
                scopePath: scope.path,
                ...splitGlobs([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            })),
    ];
}

function buildManifestRuleBlocks(scopes: Scope[], dependencyFiles: DependencyFile[]): EslintRuleBlock[] {
    return scopes.flatMap((scope) =>
        listManifestRuleBlocks(
            scope,
            listNestedScopes(
                scopes.map((each) => each.path),
                scope.path,
            ).map((path) => `!${joinScope(escapeGlob(path), '**')}`),
            listProjectDependencyNames(dependencyFiles, scope.path),
        ),
    );
}

function buildEnvironmentRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settings.level !== 'all') return [];
    return buildScopeOverrideBlocks(session.scopes, {
        read: (scope) => scope.settings.tables.structure?.environment_readers ?? [],
        build: ({ scope, value, ignores }) =>
            value.length === 0
                ? []
                : [
                      {
                          scopePath: scope.path,
                          ...splitGlobs([
                              buildExtensionGlob(...ENVIRONMENT_LANGUAGES),
                              ...buildNodePatterns(nodeFiles, scope.path),
                              ...[...value, ...ignores].map((path) => `!${path}`),
                          ]),
                          rules: ENVIRONMENT_RULES,
                      },
                  ],
    });
}

function buildTrivialRules(
    scope: Scope,
    language: (typeof CODE_LANGUAGES)[number],
    reexports: Settings['structure']['reexports'],
): Record<string, unknown> {
    const limitRules = getRequired(LIMIT_RULES_BY_CHECK, ESLINT_CHECK, 'limit rules');
    const tables = scope.configurations.map(({ eslint }) => eslint);
    const forwardingFiles = tables.flatMap(({ forwarding_files }) => forwarding_files.flatMap(({ files }) => files));
    return {
        [TRIVIAL_FILES_RULE]: [
            'error',
            {
                reexports,
                indexExports: getLimit(scope.settings, limitRules[TRIVIAL_FILES_RULE] as string, language),
                ...(forwardingFiles.length > 0 && { forwardingFiles }),
            },
        ],
        [TRIVIAL_FUNCTIONS_RULE]: [
            'error',
            {
                trivialFunctionStatements: getLimit(
                    scope.settings,
                    limitRules[TRIVIAL_FUNCTIONS_RULE] as string,
                    language,
                ),
            },
        ],
    };
}

function groupTrivialRules(
    scope: Scope,
    parent: Scope | undefined,
    reexports: Settings['structure']['reexports'],
): Array<{ rules: Record<string, unknown>; languages: string[] }> {
    const groups = new Map<string, { rules: Record<string, unknown>; languages: string[] }>();
    for (const language of CODE_LANGUAGES) {
        const rules = buildTrivialRules(scope, language, reexports);
        if (parent !== undefined && isDeepStrictEqual(rules, buildTrivialRules(parent, language, reexports))) continue;
        const key = JSON.stringify(rules);
        groups.set(key, { rules, languages: [...(groups.get(key)?.languages ?? []), language] });
    }
    return groups.values().toArray();
}

function buildTrivialRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settings.level !== 'all') return [];
    const { reexports } = session.settings.structure;
    return buildScopeOverrideBlocks(session.scopes, {
        read: (scope) => CODE_LANGUAGES.map((language) => buildTrivialRules(scope, language, reexports)),
        build: ({ scope, parent }) =>
            groupTrivialRules(scope, parent, reexports).map(({ rules, languages }) => ({
                scopePath: scope.path,
                ...splitGlobs(
                    languages.flatMap((language) =>
                        language === 'javascript'
                            ? [buildExtensionGlob('javascript'), ...buildNodePatterns(nodeFiles, scope.path)]
                            : buildExtensionGlob(...TYPED_LANGUAGES),
                    ),
                ),
                rules,
            })),
    });
}

function buildSettingsBlocks(planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session } = planned;
    const ignored = session.settings.ignore.flatMap((ignore): EslintRuleBlock[] =>
        ignore.rule === undefined || ignore.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scopePath: '',
                      ...splitGlobs(ignore.paths ?? ['**/*']),
                      rules: { [ignore.rule]: 'off' },
                  },
              ],
    );
    return [
        ...buildLimitRuleBlocks(planned),
        ...buildEnvironmentRuleBlocks(planned),
        ...buildTrivialRuleBlocks(planned),
        ...buildManifestRuleBlocks(session.scopes, session.repository.dependencyFiles),
        ...ignored,
    ];
}

/**
Build the lint rule options and the path overrides in order, each for its own project.

@param settings the parsed gspot.toml.
@param scopes every project, that owns its configured rule options.

@returns one option block per scope and path override, in the order they apply.
*/
export function buildRuleOptions(settings: Settings, scopes: Scope[]): EslintRuleOptions[] {
    const scopesByPath = new Map(scopes.map((scope) => [scope.path, scope]));
    const tables = listSettingsTables(settings).toSorted((first, second) =>
        compareScopeDepth(first.scopePath, second.scopePath),
    );
    const scopeSettings = tables.flatMap<ScopeEslintSettings>(({ scopePath = '', table }) => {
        const owner = scopesByPath.get(scopePath);
        const options = table.tools?.['eslint'];
        return owner === undefined || options === undefined ? [] : { scope: owner, settings: options };
    });
    const scopeOptions = scopeSettings.flatMap(({ scope, settings }): EslintRuleOptions[] =>
        settings.rules === undefined
            ? []
            : [
                  {
                      scopePath: scope.path,
                      ...splitGlobs(['**/*']),
                      rules: settings.rules,
                  },
              ],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined
                ? []
                : {
                      scopePath: scope.path,
                      ...splitGlobs(paths.map((path) => joinScopeSelector(path, scope.path))),
                      rules: rules,
                  },
        ),
    );
    return [...scopeOptions, ...overrides];
}

/**
Build import restrictions where a scope changes the list inherited from its parent.

@param planned the planned ESLint file.
@returns one block per changed list, excluding scopes with their own lists.
*/
export function buildRestrictedImportBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'eslintFiles'>,
): EslintBlockFields[] {
    const scopes = planned.session.scopes.filter(({ settings }) =>
        settings.configurations.includes(JAVASCRIPT_CONFIGURATION),
    );
    return buildScopeOverrideBlocks(scopes, {
        read: ({ settings }) => getTable(settings, 'javascript').banned_imports,
        build: ({ scope, parent, value, ignores }) =>
            parent === undefined && value.length === 0
                ? []
                : [
                      {
                          files: buildScopeFiles(planned.eslintFiles.code, scope.path, ['**/*']),
                          ignores,
                          rules: { 'no-restricted-imports': ['error', { paths: value }] },
                      },
                  ],
    });
}

/**
Build the settings blocks: limit, environment, trivial-code, turned-off rule, and ignore blocks. Split each into a
block for the code files and a block for the package.json files, and drop the blocks with no rules.

@param planned the planned ESLint file.
*/
export function splitSettingsBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles' | 'eslintFiles'>,
): EslintBlockFields[] {
    return buildSettingsBlocks(planned).flatMap(({ scopePath, includes, excludes, rules }) => {
        const rulePairs = Object.entries(rules);
        return [
            {
                files: buildScopeFiles(planned.eslintFiles.code, scopePath, includes),
                ignores: excludes,
                rules: Object.fromEntries(rulePairs.filter(([name]) => !name.startsWith(PACKAGE_JSON_RULE_PREFIX))),
            },
            {
                files: buildScopeFiles([PACKAGE_JSON_PATTERN], scopePath, includes),
                ignores: excludes,
                rules: Object.fromEntries(rulePairs.filter(([name]) => name.startsWith(PACKAGE_JSON_RULE_PREFIX))),
            },
        ].filter((block) => Object.keys(block.rules).length > 0);
    });
}
