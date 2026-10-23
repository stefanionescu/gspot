import { DRIZZLE_RULES } from '#cli/config/generation/configurations/library/drizzle.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
 * Require safe changes in Drizzle queries.
 *
 * @param scope the planned ESLint file of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildDrizzleBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'settings'>): ConfigurationBlocks {
    const { eslintFiles, settings } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [];
    const rule = ['error', { drizzleObjectName: settings.settings['drizzle.client_names'] }];
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
