import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/system/paths.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import { LIMIT_RULES_BY_CHECK } from '#cli/manifests/limits.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { getLimit, getTable, findParentScope } from '#cli/settings/scopes.ts';
import { joinScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import { buildLimitRuleBlocks } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';

import {
    splitGlobs,
    buildScopeFiles,
    buildNodePatterns,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import type {
    EslintRuleBlock,
    EslintBlockFields,
    EslintRuleOptions,
    PlannedEslintFile,
    ScopeEslintSettings,
} from '#cli/types/configurations/language.ts';
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
            .flatMap(({ client_env }) => client_env)
            .filter(({ dependencies }) => dependencies.every((name) => dependencyNames.includes(name)))
            .map(({ files, public_prefixes, allowed_names }) => ({
                scope: scope.path,
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
                scope: scope.path,
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
    const { scopes } = session;
    const environmentScopes = scopes.filter((scope) => {
        const parent = findParentScope(scopes, scope.path);
        return (
            parent === undefined ||
            !isDeepStrictEqual(
                scope.settings.tables.structure?.environment_readers,
                parent.settings.tables.structure?.environment_readers,
            )
        );
    });
    return environmentScopes.flatMap((scope) => {
        const owners = scope.settings.tables.structure?.environment_readers ?? [];
        return owners.length === 0
            ? []
            : {
                  scope: scope.path,
                  ...splitGlobs([
                      `**/*.{${listTaggedExtensions(...ENVIRONMENT_LANGUAGES)
                          .map((extension) => extension.slice(1))
                          .join(',')}}`,
                      ...buildNodePatterns(nodeFiles, scope.path),
                      ...owners.map((path) => `!${path}`),
                      ...listNestedScopes(
                          environmentScopes.map(({ path }) => path),
                          scope.path,
                      )
                          .map((path) => joinScope(escapeGlob(path), '**'))
                          .map((path) => `!${path}`),
                  ]),
                  rules: ENVIRONMENT_RULES,
              };
    });
}

function buildTrivialRules(
    scope: Scope,
    language: (typeof CODE_LANGUAGES)[number],
    reexports: Settings['structure']['reexports'],
): Record<string, unknown> {
    const limitRules = LIMIT_RULES_BY_CHECK.get(ESLINT_CHECK) as Record<string, string>;
    const tables = scope.configurations.map(({ eslint }) => eslint);
    const exportNames = tables.flatMap(({ export_names }) => export_names);
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
                ...(exportNames.length > 0 && { exportNames }),
            },
        ],
    };
}

function groupTrivialRules(
    scope: Scope,
    parent: Scope | undefined,
    reexports: Settings['structure']['reexports'],
): { rules: Record<string, unknown>; languages: string[] }[] {
    const groups = new Map<string, { rules: Record<string, unknown>; languages: string[] }>();
    for (const language of CODE_LANGUAGES) {
        const rules = buildTrivialRules(scope, language, reexports);
        if (parent !== undefined && isDeepStrictEqual(rules, buildTrivialRules(parent, language, reexports))) continue;
        const key = JSON.stringify(rules);
        groups.set(key, { rules, languages: [...(groups.get(key)?.languages ?? []), language] });
    }
    return [...groups.values()];
}

function buildTrivialRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    if (session.settings.level !== 'all') return [];
    const { scopes } = session;
    const blocks: EslintRuleBlock[] = [];
    for (const scope of scopes.toSorted((a, b) => compareScopeDepth(a.path, b.path))) {
        const parent = findParentScope(scopes, scope.path);
        for (const { rules, languages } of groupTrivialRules(scope, parent, session.settings.structure.reexports)) {
            const patterns = languages.flatMap((language) =>
                language === 'javascript'
                    ? [
                          `**/*.{${listTaggedExtensions('javascript')
                              .map((extension) => extension.slice(1))
                              .join(',')}}`,
                          ...buildNodePatterns(nodeFiles, scope.path),
                      ]
                    : `**/*.{${listTaggedExtensions(...TYPED_LANGUAGES)
                          .map((extension) => extension.slice(1))
                          .join(',')}}`,
            );
            blocks.push({ scope: scope.path, ...splitGlobs(patterns), rules });
        }
    }
    return blocks;
}

function buildSettingsBlocks(planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles'>): EslintRuleBlock[] {
    const { session } = planned;
    const ignored = session.settings.ignore.flatMap((ignore): EslintRuleBlock[] =>
        ignore.rule === undefined || ignore.check !== ESLINT_CHECK
            ? []
            : [
                  {
                      scope: '',
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
        compareScopeDepth(first.scope, second.scope),
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
                      rules: settings.rules,
                  },
              ],
    );
    const overrides = scopeSettings.flatMap(({ scope, settings }) =>
        (settings.override ?? []).flatMap(({ paths, rules }) =>
            rules === undefined
                ? []
                : {
                      scope: scope.path,
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
    const restrictedScopes = scopes.filter((scope) => {
        const parent = findParentScope(scopes, scope.path);
        return !isDeepStrictEqual(
            getTable(scope.settings, 'javascript').banned_imports,
            parent === undefined ? [] : getTable(parent.settings, 'javascript').banned_imports,
        );
    });
    return restrictedScopes.map((scope) => ({
        files: buildScopeFiles(planned.eslintFiles.code, scope.path, ['**/*']),
        ignores: listNestedScopes(
            restrictedScopes.map(({ path }) => path),
            scope.path,
        ).map((path) => joinScope(escapeGlob(path), '**')),
        rules: {
            'no-restricted-imports': ['error', { paths: getTable(scope.settings, 'javascript').banned_imports }],
        },
    }));
}

/**
Build the settings blocks: limit, environment, trivial-code, turned-off rule, and ignore blocks. Split each into a
block for the code files and a block for the package.json files, and drop the blocks with no rules.

@param planned the planned ESLint file.
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
                rules: Object.fromEntries(rulePairs.filter(([name]) => !name.startsWith(PACKAGE_JSON_RULE_PREFIX))),
            },
            {
                files: buildScopeFiles([PACKAGE_JSON_PATTERN], scope, includes),
                ignores: excludes,
                rules: Object.fromEntries(rulePairs.filter(([name]) => name.startsWith(PACKAGE_JSON_RULE_PREFIX))),
            },
        ].filter((block) => Object.keys(block.rules).length > 0);
    });
}
