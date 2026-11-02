import { getRequired } from '#cli/system/tables.ts';
import type { ScopeSettings } from '#cli/types/settings.ts';
import { getLimit, getTable } from '#cli/settings/scopes.ts';
import { LIMIT_RULES_BY_CHECK } from '#cli/manifests/limits.ts';
import { ESLINT_CHECK, ESLINT_LIMIT_OPTIONS } from '#cli/config/configurations/blocks.ts';
import type { EslintRuleBlock, EslintLevelRules, PlannedEslintFile } from '#cli/types/configurations/language.ts';

import {
    splitGlobs,
    buildNodePatterns,
    buildExtensionGlob,
    buildScopeOverrideBlocks,
} from '#cli/configurations/language/javascript/eslint/files.ts';

function buildLimitRules(scopeSettings: ScopeSettings, language: 'typescript' | 'javascript'): Record<string, unknown> {
    const limitRules = getRequired(LIMIT_RULES_BY_CHECK, ESLINT_CHECK, 'limit rules');
    return Object.fromEntries(
        Object.entries(ESLINT_LIMIT_OPTIONS).map(([rule, options]): [string, unknown] => {
            const maximum = getLimit(scopeSettings, limitRules[rule] as string, language);
            return [rule, ['error', Object.keys(options).length > 0 ? { max: maximum, ...options } : maximum]];
        }),
    );
}

/**
Build the code and JavaScript limit rules of one scope.

@param settings the configured size and complexity thresholds for this project.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The ESLint plan and buildLimitRuleBlocks read the limit rules of a scope through it.
export function buildScopeLimitRules(settings: ScopeSettings): EslintLevelRules {
    return {
        code: {
            ...buildLimitRules(settings, 'typescript'),
            'gspot/no-identical-functions': [
                'error',
                { minLines: getTable(settings, 'structure').min_duplicate_lines },
            ],
        },
        javascript: buildLimitRules(settings, 'javascript'),
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
    return buildScopeOverrideBlocks(session.scopes, {
        base: planned.scope,
        read: ({ settings }) => buildScopeLimitRules(settings),
        build: ({ scope, value }) => {
            const javascriptFiles = [buildExtensionGlob('javascript'), ...buildNodePatterns(nodeFiles, scope.path)];
            return [
                { scope: scope.path, ...splitGlobs(['**/*']), rules: value.code },
                { scope: scope.path, ...splitGlobs(javascriptFiles), rules: value.javascript },
            ];
        },
    });
}
