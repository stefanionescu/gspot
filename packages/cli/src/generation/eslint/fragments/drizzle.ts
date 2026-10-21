import { DRIZZLE_RULES, FRAGMENT_IMPORTS } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';

/**
 * Require safe changes in Drizzle queries.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildDrizzleFragment(context: Pick<EslintFragmentContext, 'eslintFiles' | 'view'>): EslintFragment {
    const { eslintFiles, view } = context;
    const blocks: EslintFragment['blocks'] = [];
    const rule = ['error', { drizzleObjectName: view.settings['drizzle.client_names'] }];
    blocks.push({
        data: {
            files: eslintFiles.code,
            rules: Object.fromEntries(DRIZZLE_RULES.map((name) => [name, rule])),
        },
        properties: 'plugins: { drizzle: drizzlePlugin }',
    });
    return {
        imports: FRAGMENT_IMPORTS['drizzle'],
        blocks,
    };
}
export { buildDrizzleFragment };
