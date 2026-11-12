import { isDeepStrictEqual } from 'node:util';

import { ESLINT_CHECK, ESLINT_LIMIT_OPTIONS } from '#cli/config/configurations/javascript/eslint-blocks.ts';
import {
    buildExtensionGlob,
    buildNodePatterns,
    buildScopeOverrideBlocks,
    splitGlobs,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import { LIMIT_RULES_BY_CHECK } from '#cli/manifests/limits.ts';
import { getLimit, getTable } from '#cli/settings/scopes.ts';
import { getRequired } from '#cli/system/tables.ts';
import type { EslintLanguageRules, EslintRuleBlock, PlannedEslintFile } from '#cli/types/configurations/javascript.ts';
import type { ScopeSettings } from '#cli/types/settings.ts';

function buildLimitRules(scopeSettings: ScopeSettings, language: 'typescript' | 'javascript'): Record<string, unknown> {
    const limitRules = getRequired(LIMIT_RULES_BY_CHECK, ESLINT_CHECK, 'limit rules');
    return Object.fromEntries(
        Object.entries(ESLINT_LIMIT_OPTIONS).map(([rule, options]): [string, unknown] => {
            const maximum = getLimit(scopeSettings, limitRules[rule] as string, language);
            return [rule, ['error', Object.keys(options).length > 0 ? { max: maximum, ...options } : maximum]];
        }),
    );
}

export function buildScopeLimitRules(settings: ScopeSettings): EslintLanguageRules {
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
scope that owns the file, whose limits the base blocks hold. A block holds only the rules that change, because ESLint
keeps the earlier blocks' other rules for the same files.

@returns up to two blocks for each scope with its own limits: one for its code files and one for its JavaScript files.
The JavaScript block also restates each rule that the code block changes, because the code block reaches JavaScript
files too.
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
        build: ({ scope, parent, value }) => {
            const inherited = buildScopeLimitRules((parent ?? planned.scope).settings);
            const javascriptFiles = [buildExtensionGlob('javascript'), ...buildNodePatterns(nodeFiles, scope.path)];
            const code = Object.entries(value.code).filter(
                ([rule, options]) => !isDeepStrictEqual(options, inherited.code[rule]),
            );
            const changed = new Set(code.map(([rule]) => rule));
            const javascript = Object.entries(value.javascript).filter(
                ([rule, options]) => changed.has(rule) || !isDeepStrictEqual(options, inherited.javascript[rule]),
            );
            return [
                { scopePath: scope.path, ...splitGlobs(['**/*']), rules: Object.fromEntries(code) },
                { scopePath: scope.path, ...splitGlobs(javascriptFiles), rules: Object.fromEntries(javascript) },
            ].filter((block) => Object.keys(block.rules).length > 0);
        },
    });
}
