import { isDeepStrictEqual } from 'node:util';
import type { Scope, Settings } from '#cli/types/settings.ts';
import { CODE_LANGUAGES } from '#cli/config/configurations/javascript/projects.ts';
import { ENVIRONMENT_RULES } from '#cli/config/configurations/javascript/rules.ts';
import { getRuleLimit } from '#cli/configurations/language/javascript/eslint/blocks/limits.ts';
import type { EslintRuleBlock, PlannedEslintFile } from '#cli/types/configurations/javascript.ts';
import { buildScopeOverrideBlocks } from '#cli/configurations/language/javascript/eslint/scopes.ts';

import {
    splitGlobs,
    buildNodePatterns,
    buildExtensionGlob,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import {
    TYPED_LANGUAGES,
    TRIVIAL_FILES_RULE,
    ENVIRONMENT_LANGUAGES,
    TRIVIAL_FUNCTIONS_RULE,
} from '#cli/config/configurations/javascript/blocks.ts';

function buildTrivialRules(
    scope: Scope,
    language: (typeof CODE_LANGUAGES)[number],
    reexports: Settings['structure']['reexports'],
): Record<string, unknown> {
    const tables = scope.configurations.map(({ eslint }) => eslint);
    const forwardingFiles = tables.flatMap(({ forwarding_files }) => forwarding_files.flatMap(({ files }) => files));
    return {
        [TRIVIAL_FILES_RULE]: [
            'error',
            {
                reexports,
                indexExports: getRuleLimit(scope.settings, TRIVIAL_FILES_RULE, language),
                ...(forwardingFiles.length > 0 && { forwardingFiles }),
            },
        ],
        [TRIVIAL_FUNCTIONS_RULE]: [
            'error',
            {
                trivialFunctionStatements: getRuleLimit(scope.settings, TRIVIAL_FUNCTIONS_RULE, language),
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

export function buildEnvironmentRuleBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>,
): EslintRuleBlock[] {
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

export function buildTrivialRuleBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintRuleBlock[] {
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
