import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
Apply the TanStack Query presets to the code files.

@param scope the code selectors.
@returns the plugin and the preset blocks.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The configuration builder table or shared block builders call this function.
export function buildTanstackQueryBlocks(scope: Pick<EslintScope, 'eslintFiles'>): ConfigurationBlocks {
    return {
        imports: CONFIGURATION_PLUGINS['tanstack-query'],
        blocks: [
            {
                fields: { files: scope.eslintFiles.code },
                presets: [{ importName: 'tanstackQuery', path: 'configs.flat/recommended', merge: 'spread' }],
            },
        ],
    };
}
