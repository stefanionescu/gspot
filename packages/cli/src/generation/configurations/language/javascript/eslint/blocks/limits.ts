import { isDeepStrictEqual } from 'node:util';
import type { Settings } from '#cli/types/settings/file.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { getLimit, getTable, findParentScope } from '#cli/settings/scopes.ts';
import type { EslintRuleBlock, EslintLevelRules, PlannedEslintFile } from '#cli/types/generation/eslint.ts';

import {
    BARREL_FILES_RULE,
    ESLINT_LIMIT_RULES,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/limits.ts';
import {
    splitGlobs,
    buildNodePatterns,
    buildSourcePattern,
} from '#cli/generation/configurations/language/javascript/eslint/files.ts';

/**
Build the ESLint rules of the size and complexity limits of one language.

@param settings the scope settings that the limits read.
@param language the language whose limits apply.
@returns each limit rule with its maximum.
*/
export function buildLimitRules(
    settings: ScopeSettings,
    language: 'typescript' | 'javascript',
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(ESLINT_LIMIT_RULES).map(([rule, limitRule]) => {
            const maximum = getLimit(settings, limitRule.limit, language);
            return [rule, ['error', 'options' in limitRule ? { max: maximum, ...limitRule.options } : maximum]];
        }),
    );
}

/**
Build the barrel-files rule when only index files may re-export.

@param repositorySettings the parsed gspot.toml.
@param settings the scope settings that the index_exports limit reads.
@param language the language whose limit applies.
@returns the rule with its export maximum, or no rule.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 2 files share it.
export function buildBarrelRule(
    repositorySettings: Settings,
    settings: ScopeSettings,
    language: 'typescript' | 'javascript',
): Record<string, unknown> {
    return repositorySettings.structure.reexports === 'index-only'
        ? {
              [BARREL_FILES_RULE]: [
                  'error',
                  { amountOfExportsToConsiderModuleAsBarrel: getLimit(settings, 'index_exports', language) },
              ],
          }
        : {};
}

/**
Build a limit block for each scope whose limits differ from its parent, deeper scopes last. The root compares with the
scope that owns the file, whose limits the base blocks hold.

@param planned the scopes, the scope that owns the file, and the Node.js scripts of the repository.
@returns two blocks for each scope with its own limits: one for its code files and one for its JavaScript files.
*/
export function buildLimitRuleBlocks(
    planned: Pick<PlannedEslintFile, 'session' | 'scope' | 'nodeFiles'>,
): EslintRuleBlock[] {
    const { session, nodeFiles } = planned;
    const repositorySettings = session.settingsFile.settings;
    if (repositorySettings.level !== 'all') return [];
    const { scopes } = session;
    const limitsByScope = new Map(
        scopes.map(({ settings }): [ScopeSettings, EslintLevelRules] => [
            settings,
            {
                code: {
                    ...buildLimitRules(settings, 'typescript'),
                    'sonarjs/no-identical-functions': ['error', getTable(settings, 'duplication').min_lines],
                    ...buildBarrelRule(repositorySettings, settings, 'typescript'),
                },
                javascript: {
                    ...buildLimitRules(settings, 'javascript'),
                    ...buildBarrelRule(repositorySettings, settings, 'javascript'),
                },
            },
        ]),
    );
    return scopes
        .toSorted((left, right) => compareScopeDepth(left.path, right.path))
        .flatMap((scope) => {
            const limits = limitsByScope.get(scope.settings) as EslintLevelRules;
            const parent = findParentScope(scopes, scope.path) ?? planned.scope;
            if (isDeepStrictEqual(limits, limitsByScope.get(parent.settings))) return [];
            const javascriptFiles = [buildSourcePattern('javascript'), ...buildNodePatterns(nodeFiles, scope.path)];
            return [
                { scope: scope.path, ...splitGlobs(['**/*']), rules: limits.code },
                { scope: scope.path, ...splitGlobs(javascriptFiles), rules: limits.javascript },
            ];
        });
}
