// The rule blocks of the generated ESLint configuration: policy overrides, structural ceilings, manifest exclusions,
// and the selector groups of framework fragments.
import { isDeepStrictEqual } from 'node:util';
import { LINT_CHECK } from '#cli/config/eslint.ts';
import { isRecord } from '#cli/platform/objects.ts';
import { activeIgnores } from '#cli/policy/settings/ignores.ts';
import { everyTable, policyValue } from '#cli/policy/settings/entries.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import type { Fragment, ResolvedSelector } from '#cli/types/generation/fragments.ts';
import { byScopeDepth, nestedScopes, pathExpressions } from '#cli/repository/selectors.ts';
import type { SelectorGroup, EslintRuleBlock, ScopeEslintSettings } from '#cli/types/generation/eslint.ts';

function distinctLists(lists: string[][]): string[][] {
    const seen = new Set<string>();
    return lists.filter((list) => {
        const key = JSON.stringify(list);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// The paths a loosening setting allows: every entry's paths, in the order written.
function allowedPaths(selection: ScopeSelection, setting: string): string[] {
    const value = selection.view.settings[setting];
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry: unknown) => {
        const paths = isRecord(entry) ? entry['paths'] : undefined;
        return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === 'string') : [];
    });
}

/**
 * Build base rules, ordered path overrides, then lint ignore entries, each bounded by its owning scope.
 * @param policy the repository policy
 * @returns one block per scope, path override, and lint ignore entry, in application order
 */
export function eslintRuleBlocks(policy: Policy): EslintRuleBlock[] {
    const tables = everyTable(policy).toSorted((first, second) => byScopeDepth(first.scope ?? '', second.scope ?? ''));
    const settings = tables.map<ScopeEslintSettings>(({ scope = '', table }) => ({
        scope,
        settings: table.tools?.['eslint'] ?? {},
    }));
    const base = settings.flatMap(({ scope, settings }): EslintRuleBlock[] =>
        settings.rules === undefined ? [] : [{ scope, ...pathExpressions(['**/*']), rules: settings.rules }],
    );
    const overrides = settings.flatMap(({ scope, settings }) =>
        (settings.overrides ?? []).map(({ paths, rules }) => ({ scope, ...pathExpressions(paths), rules })),
    );
    const ignores = activeIgnores(policy).flatMap((entry): EslintRuleBlock[] =>
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
 * @returns disabled rules at recommended, otherwise one block per scope and language, shallowest first
 */
export function structuralRuleBlocks(scopes: ScopeSelection[], policy: Policy): EslintRuleBlock[] {
    const blocks: EslintRuleBlock[] = [];
    if (policy.level !== 'all')
        return [
            {
                scope: '',
                ...pathExpressions(['**/*']),
                rules: { 'gspot/no-trivial-files': 'off', 'gspot/no-trivial-functions': 'off' },
            },
        ];
    for (const selection of scopes.toSorted((a, b) => byScopeDepth(a.scope.path, b.scope.path))) {
        for (const [language, pattern] of [
            ['javascript', '**/*.{js,mjs,cjs,jsx}'],
            ['typescript', '**/*.{ts,tsx,mts,cts,vue,svelte,astro}'],
        ] as const) {
            const maxStatements = selection.view.limit('min_function_statements', language);
            const options = maxStatements === undefined ? {} : { maxStatements };
            blocks.push({
                scope: selection.scope.path,
                ...pathExpressions([pattern]),
                rules: {
                    'gspot/no-trivial-files': [
                        'error',
                        {
                            ...options,
                            allowIndex: policy.structure.reexports === 'index-only',
                        },
                    ],
                    'gspot/no-trivial-functions': ['error', options],
                },
            });
        }
    }
    return blocks;
}

/**
 * The blocks that turn off reasoned manifest exclusions after structural defaults and before authored policy.
 * @param scopes the selected configurations and their owning scopes.
 * @param policy the effective root policy.
 * @returns scoped rule blocks that exclude every nested scope.
 */
export function manifestRuleBlocks(scopes: ScopeSelection[], policy: Policy): EslintRuleBlock[] {
    return scopes.flatMap((selection) => {
        const scope = selection.scope.path;
        const children = nestedScopes(
            scopes.map((entry) => entry.scope.path),
            scope,
        );
        const excluded = children.map((path) => `!${path}/**`);
        return selection.selected
            .flatMap((manifest) => manifest.eslint_rules_off)
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

/**
 * Resolve the actual selectors contributed by selected fragments within each project scope.
 * @param scopes every resolved project scope
 * @param fragments the fragments contributing to this configuration
 * @param isAll whether house style selectors apply
 * @returns selector groups with their owning scope and excluded child projects
 */
export function fragmentSelectorGroups(
    scopes: ScopeSelection[],
    fragments: Fragment[],
    isAll: boolean,
): SelectorGroup[] {
    return scopes.flatMap((scope) => {
        const resolved = fragments
            .filter(({ manifest }) => scope.selected.includes(manifest))
            .flatMap(({ config }) =>
                config.selectors
                    .filter((entry) => isAll || entry.level === 'recommended')
                    .map(
                        (entry): ResolvedSelector => ({
                            selector: entry.selector,
                            message: entry.message,
                            ...(entry.files === undefined ? {} : { files: entry.files }),
                            ...(entry.allowed === undefined ? {} : { except: allowedPaths(scope, entry.allowed) }),
                        }),
                    ),
            );
        return selectorGroups(resolved).map((group) => ({
            ...group,
            scope: scope.scope.path,
            ignoredScopes: nestedScopes(
                scopes.map((entry) => entry.scope.path),
                scope.scope.path,
            ),
        }));
    });
}
