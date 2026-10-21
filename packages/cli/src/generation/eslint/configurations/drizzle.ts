import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { DRIZZLE_RULES, CONFIGURATION_PLUGINS } from '#cli/config/generation/eslint/configurations.ts';

/**
 * Require safe changes in Drizzle queries.
 *
 * @param scope the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildDrizzleBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'view'>): ConfigurationBlocks {
    const { eslintFiles, view } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [];
    const rule = ['error', { drizzleObjectName: view.settings['drizzle.client_names'] }];
    blocks.push({
        data: {
            files: eslintFiles.code,
            rules: Object.fromEntries(DRIZZLE_RULES.map((name) => [name, rule])),
        },
        properties: 'plugins: { drizzle: drizzlePlugin }',
    });
    return {
        imports: CONFIGURATION_PLUGINS['drizzle'],
        blocks,
    };
}
