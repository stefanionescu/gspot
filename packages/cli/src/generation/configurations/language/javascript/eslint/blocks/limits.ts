import { isDeepStrictEqual } from 'node:util';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import type { ParsedStructure } from '#cli/types/settings/values.ts';
import { type ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { getLimit, getTable, findParentScope } from '#cli/settings/scopes.ts';
import type { EslintRuleBlock, EslintLevelRules, PlannedEslintFile } from '#cli/types/generation/eslint.ts';
import { splitGlobs, buildNodePatterns } from '#cli/generation/configurations/language/javascript/eslint/files.ts';

import {
    BARREL_FILES_RULE,
    ESLINT_LIMIT_RULES,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/limits.ts';

function buildLimitRules(
    scopeSettings: ScopeSettings,
    language: 'typescript' | 'javascript',
    reexports: ParsedStructure['reexports'],
): Record<string, unknown> {
    const barrelRule: [string, unknown] = [
        BARREL_FILES_RULE,
        ['error', { amountOfExportsToConsiderModuleAsBarrel: getLimit(scopeSettings, 'index_exports', language) }],
    ];
    return Object.fromEntries([
        ...Object.entries(ESLINT_LIMIT_RULES).map(([rule, limitRule]): [string, unknown] => {
            const maximum = getLimit(scopeSettings, limitRule.limit, language);
            return [rule, ['error', 'options' in limitRule ? { max: maximum, ...limitRule.options } : maximum]];
        }),
        ...(reexports === 'index-only' ? [barrelRule] : []),
    ]);
}

/**
Build the code and JavaScript limit rules of one scope.

@param settings the configured size and complexity thresholds for this project.
@param reexports the structure.reexports mode, which turns on the barrel-files rule at index-only.
@returns the limit rules, by rule ID.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The configuration builder table or shared block builders call this function.
export function buildScopeLimitRules(
    settings: ScopeSettings,
    reexports: ParsedStructure['reexports'],
): EslintLevelRules {
    return {
        code: {
            ...buildLimitRules(settings, 'typescript', reexports),
            'sonarjs/no-identical-functions': ['error', getTable(settings, 'duplication').min_lines],
        },
        javascript: buildLimitRules(settings, 'javascript', reexports),
    };
}

/**
Build a limit block for each scope whose limits differ from its parent, deeper scopes last. The root compares with the
scope that owns the file, whose limits the base blocks hold.

@param planned the planned ESLint file.
@returns two blocks for each scope with its own limits: one for its code files and one for its JavaScript files.
*/
export function buildLimitRuleBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles'>,
): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    const repositorySettings = session.settings;
    if (repositorySettings.level !== 'all') return [];
    const { scopes } = session;
    const limitsByScope = new Map(
        scopes.map(({ settings }): [ScopeSettings, EslintLevelRules] => [
            settings,
            buildScopeLimitRules(settings, repositorySettings.structure.reexports),
        ]),
    );
    return scopes
        .toSorted((left, right) => compareScopeDepth(left.path, right.path))
        .flatMap((scope) => {
            const limits = limitsByScope.get(scope.settings) as EslintLevelRules;
            const parent = findParentScope(scopes, scope.path) ?? planned.scope;
            if (isDeepStrictEqual(limits, limitsByScope.get(parent.settings))) return [];
            const javascriptFiles = [
                `**/*.{${listTaggedExtensions('javascript')
                    .map((extension) => extension.slice(1))
                    .join(',')}}`,
                ...buildNodePatterns(nodeFiles, scope.path),
            ];
            return [
                { scope: scope.path, ...splitGlobs(['**/*']), rules: limits.code },
                { scope: scope.path, ...splitGlobs(javascriptFiles), rules: limits.javascript },
            ];
        });
}
