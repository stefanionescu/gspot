import { joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { serializeBlock } from '#cli/generation/eslint/print.ts';
import { buildScopeFiles } from '#cli/generation/eslint/files.ts';
import type { EslintModule, EslintModuleInput, EslintSettingsBlock } from '#cli/types/generation/eslint.ts';

/**
 * Write ESLint blocks for the selected level and project scope.
 *
 * @param input the level, generated file selectors, your own options, and optional fragment scope.
 *
 * @returns the emitted blocks and their rule options in the same order.
 */
export function createBlockWriter(input: EslintModuleInput): EslintModule {
    const { allRules, isAll, codeFiles, ruleOptions, scope } = input;
    const blocks: EslintSettingsBlock[] = [];
    return {
        blocks,
        block: (payload, runtime, preset) => {
            const rules: Record<string, unknown> = Object.fromEntries(
                (payload.rules === undefined ? [] : Object.entries(payload.rules)).map(([name, value]) => [
                    name,
                    !isAll && allRules.has(name) ? 'off' : value,
                ]),
            );
            const nested =
                scope === undefined
                    ? {}
                    : {
                          files: (payload.files ?? codeFiles).map((entry) => [
                              ...(Array.isArray(entry) ? entry : [entry]),
                              joinScope(escapeGlob(scope.path), '**/*'),
                          ]),
                          ignores: [...(payload.ignores ?? []), ...scope.excluded],
                      };
            const block = { ...payload, ...nested, rules };
            const configured = ruleOptions.flatMap((options): EslintSettingsBlock[] => {
                const entries = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
                    const chosen = options.rules[name];
                    const severity: unknown = Array.isArray(value) ? value[0] : value;
                    return chosen === undefined || severity === 'off' || severity === 0
                        ? []
                        : [[name, [severity, ...chosen]]];
                });
                if (entries.length === 0) return [];
                const selectedRules: Record<string, unknown> = Object.fromEntries<unknown>(entries);
                return [
                    {
                        ...block,
                        files: buildScopeFiles(block.files ?? codeFiles, options.scope, options.includes),
                        ignores: [...(block.ignores ?? []), ...options.excludes],
                        rules: selectedRules,
                    },
                ];
            });
            const emitted = [block, ...configured];
            blocks.push(...emitted);
            return emitted
                .map((entry, index) => {
                    const source = serializeBlock(entry, index === 0 ? runtime : '', index === 0 ? preset : undefined);
                    return scope === undefined ? source : `stripRuntimeGlobals(${source})`;
                })
                .join(',\n');
        },
    };
}

/**
 * Preserve every preset option while promoting enabled warnings to errors.
 *
 * @param rules the actual rules from a pinned preset.
 *
 * @returns error settings, with disabled rules retained.
 */
export function convertWarningsToErrors(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, entry]) => {
            const entries: unknown[] = Array.isArray(entry) ? entry : [entry];
            const [level, ...options] = entries;
            return [rule, level === 'off' || level === 0 ? 'off' : ['error', ...options]];
        }),
    );
}
