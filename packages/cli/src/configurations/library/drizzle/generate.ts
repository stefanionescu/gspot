import { getTable } from '#cli/settings/scopes.ts';
import { DRIZZLE_RULES } from '#cli/config/configurations/framework.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

/**
Require safe changes in Drizzle queries.

@param scope the planned ESLint file of the scope.
*/
export function buildDrizzleBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'settings'>): ConfigurationBlocks {
    const { eslintFiles, settings } = scope;
    const rule = ['error', { drizzleObjectName: getTable(settings, 'drizzle').client_names }];
    return [
        {
            fields: {
                files: eslintFiles.code,
                rules: Object.fromEntries(DRIZZLE_RULES.map((name) => [name, rule])),
            },
            calls: [{ name: 'addPlugins', args: [{ plugins: ['eslint-plugin-drizzle'] }] }],
        },
    ];
}
