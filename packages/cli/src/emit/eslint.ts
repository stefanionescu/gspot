import type { Policy } from '#cli/policy/normalize.ts';
import type { EslintSettings } from '#cli/policy/schema.ts';
import { pathExpressions } from '#cli/configurations/claims.ts';
import type { PathExpressions } from '#cli/repository/patterns.ts';

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
