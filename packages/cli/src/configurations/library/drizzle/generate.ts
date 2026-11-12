import { DRIZZLE_RULES } from '#cli/config/configurations/framework.ts';
import { getTable } from '#cli/settings/scopes.ts';
import {
    type ConfigurationBlocks,
    type ConfigurationBuilder,
    type EslintScope,
} from '#cli/types/configurations/javascript.ts';

function buildDrizzleBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'settings'>): ConfigurationBlocks {
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

export const DRIZZLE_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    drizzle: buildDrizzleBlocks,
};
