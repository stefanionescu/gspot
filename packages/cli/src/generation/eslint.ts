import type { FragmentSelector } from '#cli/configurations/schema.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import type { EslintSettings } from '#cli/policy/schema.ts';
import type { PathExpressions } from '#cli/repository/paths.ts';
import { pathExpressions } from '#cli/repository/paths.ts';

/**
 * Emit base rules first, then ordered path overrides, with each declaration bounded by its owning scope.
 * @param policy
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
        entry.rule === undefined || !['javascript/eslint', 'typescript/eslint'].includes(entry.check)
            ? []
            : [
                  {
                      scope: '',
                      ...pathExpressions(entry.paths?.length ? entry.paths : ['**/*']),
                      rules: { [entry.rule]: 'off' },
                  },
              ],
    );
    return [...base, ...overrides, ...ignores];
}

export type EslintRuleBlock = PathExpressions & { scope: string; rules: Record<string, unknown> };

export function structuralRuleBlocks(scopes: ScopeSelection[]): EslintRuleBlock[] {
    const blocks: EslintRuleBlock[] = [];
    for (const selection of scopes.toSorted((a, b) => a.scope.path.length - b.scope.path.length)) {
        for (const [language, pattern] of [
            ['javascript', '**/*.{js,mjs,cjs,jsx}'],
            ['typescript', '**/*.{ts,tsx,mts,cts,vue,svelte}'],
        ] as const) {
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
    const groups: SelectorGroup[] = general.length === 0 ? [] : [{ selectors: general.map(shape) }];
    for (const paths of distinctLists(general.flatMap((entry) => (entry.except?.length ? [entry.except] : []))))
        groups.push({
            files: paths,
            selectors: general.filter((entry) => JSON.stringify(entry.except) !== JSON.stringify(paths)).map(shape),
        });
    for (const files of distinctLists(selectors.flatMap((entry) => (entry.files === undefined ? [] : [entry.files]))))
        groups.push({
            files,
            selectors: [
                ...general,
                ...selectors.filter((entry) => JSON.stringify(entry.files) === JSON.stringify(files)),
            ].map(shape),
        });
    return groups;
}

function shape(entry: ResolvedSelector): { selector: string; message: string } {
    return { selector: entry.selector, message: entry.message };
}

function distinctLists(lists: string[][]): string[][] {
    const seen = new Set<string>();
    return lists.filter((list) => {
        const key = JSON.stringify(list);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** A fragment selector with the allowed setting replaced by the paths it holds. */
export type ResolvedSelector = Pick<FragmentSelector, 'selector' | 'message' | 'files'> & { except?: string[] };

/** One no-restricted-syntax rule: its file set, or every code file when absent, and the selectors it holds. */
export type SelectorGroup = { files?: string[]; selectors: { selector: string; message: string }[] };
