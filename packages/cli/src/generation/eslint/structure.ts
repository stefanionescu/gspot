// Each rule comparison uses the closest containing project.

import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/repository/matchers.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { EslintContext, EslintRuleBlock } from '#cli/types/generation/eslint.ts';
import { isInScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';
import { nodePatterns, globSelectors, sourcePattern } from '#cli/generation/eslint/files.ts';

import {
    TYPED_LANGUAGES,
    ENVIRONMENT_RULES,
    TRIVIAL_FILES_RULE,
    ENVIRONMENT_LANGUAGES,
    TRIVIAL_FUNCTIONS_RULE,
    TRIVIAL_FUNCTION_LIMIT,
    DEFAULT_TRIVIAL_FUNCTION_LIMIT,
} from '#cli/config/generation/eslint.ts';

/**
 * Find the nearest enclosing selected scope.
 *
 * @param scopes the selected project scopes.
 * @param path the repository-relative destination.
 *
 * @returns the enclosing selection, or undefined at the root.
 */
export function parentSelection(scopes: ScopeSelection[], path: string): ScopeSelection | undefined {
    return scopes
        .filter(({ scope }) => scope.path !== path && isInScope(path, scope.path))
        .toSorted((left, right) => compareScopeDepth(left.scope.path, right.scope.path))
        .at(-1);
}

/**
 * Environment restrictions and trivial-code limits for each project.
 *
 * @param input the selected scopes, structural settings, and detected Node file paths.
 *
 * @returns environment and structural rules at all, otherwise no blocks.
 */
export function environmentRuleBlocks(
    input: Pick<EslintContext, 'scopes' | 'settings' | 'nodeFiles'>,
): EslintRuleBlock[] {
    const { scopes, settings, nodeFiles } = input;
    if (settings.level !== 'all') return [];
    const environmentScopes = scopes.filter((selection) => {
        const parent = parentSelection(scopes, selection.scope.path);
        return (
            parent === undefined ||
            !isDeepStrictEqual(selection.view.roles.environment_readers, parent.view.roles.environment_readers)
        );
    });
    const blocks: EslintRuleBlock[] = environmentScopes.flatMap((selection) => {
        const owners = selection.view.roles.environment_readers;
        return owners.length === 0
            ? []
            : [
                  {
                      scope: selection.scope.path,
                      ...globSelectors([
                          sourcePattern(...ENVIRONMENT_LANGUAGES),
                          ...nodePatterns(nodeFiles, selection.scope.path),
                          ...owners.map((path) => `!${path}`),
                          ...listNestedScopes(
                              environmentScopes.map(({ scope }) => scope.path),
                              selection.scope.path,
                          ).map((path) => `!${escapeGlob(path)}/**`),
                      ]),
                      rules: ENVIRONMENT_RULES,
                  },
              ];
    });
    return blocks;
}

/**
 * Calculate changed trivial-code limits for each selected project.
 *
 * @param input the source values.
 *
 * @returns the lint rules that detect unnecessary forwarding functions.
 */
export function trivialRuleBlocks(input: Pick<EslintContext, 'scopes' | 'settings' | 'nodeFiles'>): EslintRuleBlock[] {
    const { scopes, settings, nodeFiles } = input;
    if (settings.level !== 'all') return [];
    const blocks: EslintRuleBlock[] = [];
    const allowIndex = settings.structure.reexports === 'index-only';
    for (const selection of scopes.toSorted((a, b) => compareScopeDepth(a.scope.path, b.scope.path))) {
        const parent = parentSelection(scopes, selection.scope.path);
        const limits = ['javascript', 'typescript']
            .map((language) => ({
                language,
                value: selection.view.limit(TRIVIAL_FUNCTION_LIMIT, language),
            }))
            .filter(({ language, value }) =>
                selection.scope.path === ''
                    ? value !== DEFAULT_TRIVIAL_FUNCTION_LIMIT || allowIndex
                    : value !==
                      (parent?.view.limit(TRIVIAL_FUNCTION_LIMIT, language) ?? DEFAULT_TRIVIAL_FUNCTION_LIMIT),
            );
        const groups = new Map<number, string[]>();
        for (const { language, value } of limits) groups.set(value, [...(groups.get(value) ?? []), language]);
        for (const [trivialStatements, languages] of groups) {
            const patterns = languages.flatMap((language) =>
                language === 'javascript'
                    ? [sourcePattern('javascript'), ...nodePatterns(nodeFiles, selection.scope.path)]
                    : [sourcePattern(...TYPED_LANGUAGES)],
            );
            blocks.push({
                scope: selection.scope.path,
                ...globSelectors(patterns),
                rules: {
                    [TRIVIAL_FILES_RULE]: ['error', { trivialStatements, allowIndex }],
                    [TRIVIAL_FUNCTIONS_RULE]: ['error', { trivialStatements }],
                },
            });
        }
    }
    return blocks;
}
