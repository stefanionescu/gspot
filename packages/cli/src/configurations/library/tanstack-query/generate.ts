import { CONFIGURATION_PLUGINS } from '#cli/config/configurations/framework.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

/**
Apply the TanStack Query presets to the code files.

@param scope the code selectors.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIGURATION_BUILDERS calls it by configuration name, like every block builder.
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
