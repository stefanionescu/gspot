import type { EslintRuleBlock } from '#types/emit.ts';
import type { EslintSettings, Policy } from '#types/config.ts';
import { pathExpressions } from '#cli/presets/claims.ts';

/** Emit base rules first, then ordered path overrides, with each declaration bounded by its owning scope. */
export function eslintRuleBlocks(policy: Policy): EslintRuleBlock[] {
    const tables = [
        { scope: '', table: policy },
        ...Object.entries(policy.scopeTables).map(([scope, table]) => ({ scope, table })),
    ].toSorted((first, second) => first.scope.split('/').length - second.scope.split('/').length);
    const settings = tables.map(({ scope, table }) => ({
        scope,
        settings: (table.tools?.['eslint'] ?? {}) as EslintSettings,
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
