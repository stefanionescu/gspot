// The rule blocks of the generated ESLint configuration: policy overrides, structural ceilings, manifest exclusions,
// and the selector groups of framework fragments.
import { isDeepStrictEqual } from 'node:util';
import { policyValue } from '#cli/policy/settings.ts';
import { LINT_CHECK } from '#cli/config/generation/eslint.ts';
import { pathExpressions } from '#cli/repository/selectors.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/policy.ts';
import type { ResolvedSelector } from '#cli/types/generation/generation.ts';
import type { SelectorGroup, EslintSettings, EslintRuleBlock } from '#cli/types/generation/eslint.ts';

function distinctLists(lists: string[][]): string[][] {
    const seen = new Set<string>();
    return lists.filter((list) => {
        const key = JSON.stringify(list);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Emit base rules first, then ordered path overrides, with each declaration bounded by its owning scope.
 * @param policy the repository policy
 * @returns one rule block per scope and path override, in the order ESLint applies them
 */
export function eslintRuleBlocks(policy: Policy): EslintRuleBlock[] {
    const tables = [
        { scope: '', table: policy },
        ...Object.entries(policy.scopeTables).map(([scope, table]) => ({ scope, table })),
    ].toSorted((first, second) => first.scope.split('/').length - second.scope.split('/').length);
    const settings = tables.map<{ scope: string; settings: EslintSettings }>(({ scope, table }) => ({
        scope,
        settings: table.tools?.['eslint'] ?? {},
    }));
    const base = settings.flatMap(({ scope, settings }): EslintRuleBlock[] =>
        settings.rules === undefined ? [] : [{ scope, ...pathExpressions(['**/*']), rules: settings.rules }],
    );
    const overrides = settings.flatMap(({ scope, settings }) =>
        (settings.overrides ?? []).map(({ paths, rules }) => ({ scope, ...pathExpressions(paths), rules })),
    );
    const ignores = policy.ignores.flatMap((entry): EslintRuleBlock[] =>
        entry.rule === undefined || entry.check !== LINT_CHECK
            ? []
            : [
                  {
                      scope: '',
                      ...pathExpressions(
                          entry.paths === undefined || entry.paths.length === 0 ? ['**/*'] : entry.paths,
                      ),
                      rules: { [entry.rule]: 'off' },
                  },
              ],
    );
    return [...base, ...overrides, ...ignores];
}

/**
 * The per-scope rule blocks that carry the trivial-statement ceiling into the structural plugin rules.
 * @param scopes the resolved scopes, in any order.
 * @param policy the policy selecting structural rules and scoped exceptions.
 * @returns one block per scope and language, shallowest scope first
 */
export function structuralRuleBlocks(scopes: ScopeSelection[], policy: Policy): EslintRuleBlock[] {
    const blocks: EslintRuleBlock[] = [];
    for (const selection of scopes.toSorted((a, b) => a.scope.path.length - b.scope.path.length)) {
        for (const [language, pattern] of [
            ['javascript', '**/*.{js,mjs,cjs,jsx}'],
            ['typescript', '**/*.{ts,tsx,mts,cts,vue,svelte,astro}'],
        ] as const) {
            if (policy.level !== 'all') continue;
            const maxStatements =
                selection.view.limit('trivial_statements', language) ?? selection.view.limit('trivial_statements');
            blocks.push({
                scope: selection.scope.path,
                ...pathExpressions([pattern]),
                rules: {
                    'gspot/no-trivial-files': ['error', { maxStatements }],
                    'gspot/no-trivial-functions': ['error', { maxStatements }],
                },
            });
        }
    }
    return blocks;
}

/**
 * Applies reasoned manifest exclusions after structural defaults and before authored policy.
 * @param scopes the selected kits and their owning scopes.
 * @param policy the effective root policy.
 * @returns scoped rule blocks that exclude every nested scope.
 */
export function manifestRuleBlocks(scopes: ScopeSelection[], policy: Policy): EslintRuleBlock[] {
    return scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        const children = scopes
            .map((entry) => entry.scope.path)
            .filter((path) => path !== scope && (scope === '' || path.startsWith(`${scope}/`)));
        const excluded = children.map((path) => `!${path}/**`);
        return selection.selected
            .flatMap((manifest) => manifest.rules_off)
            .filter(
                ({ when: condition }) =>
                    condition === undefined ||
                    (selection.view.settings[condition.setting] ?? policyValue(policy, condition.setting)?.value) ===
                        condition.value,
            )
            .map(({ files, rules }) => ({
                scope,
                ...pathExpressions([...(files ?? ['**/*']), ...excluded]),
                rules: Object.fromEntries(rules.map((rule) => [rule, 'off'])),
            }));
    });
}

/**
 * Groups the selectors the selected fragments add so each file set gets one no-restricted-syntax rule.
 *
 * A selector without files applies to every code file. A selector with an allowed setting is left out of the group for
 * the paths that setting names. A selector with files applies there in addition to the general ones. The general group
 * comes first, then one group per allowed path set, then one group per file set, each in first-mention order.
 * @param selectors the selectors of the selected fragments, with the paths their allowed settings hold
 * @returns the groups, where an absent files list means every code file
 */
export function selectorGroups(selectors: ResolvedSelector[]): SelectorGroup[] {
    const general = selectors.filter((entry) => entry.files === undefined);
    const groups: SelectorGroup[] =
        general.length === 0
            ? []
            : [{ selectors: general.map((entry) => ({ selector: entry.selector, message: entry.message })) }];
    for (const paths of distinctLists(
        general.flatMap((entry) => (entry.except === undefined || entry.except.length === 0 ? [] : [entry.except])),
    ))
        groups.push({
            files: paths,
            selectors: general
                .filter((entry) => !isDeepStrictEqual(entry.except, paths))
                .map((entry) => ({ selector: entry.selector, message: entry.message })),
        });
    for (const files of distinctLists(selectors.flatMap((entry) => (entry.files === undefined ? [] : [entry.files]))))
        groups.push({
            files,
            selectors: [...general, ...selectors.filter((entry) => isDeepStrictEqual(entry.files, files))].map(
                (entry) => ({ selector: entry.selector, message: entry.message }),
            ),
        });
    return groups;
}
