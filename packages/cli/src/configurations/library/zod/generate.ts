import { CONFIGURATION_PLUGINS } from '#cli/config/configurations/framework.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

/**
Apply the basic rules and strict schema conventions of Zod.

@param scope the code files of the scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIGURATION_BUILDERS calls it by configuration name, like every block builder.
export function buildZodBlocks(scope: Pick<EslintScope, 'eslintFiles'>): ConfigurationBlocks {
    return {
        imports: CONFIGURATION_PLUGINS.zod,
        blocks: [
            {
                fields: {
                    files: scope.eslintFiles.code,
                    rules: {
                        'zod/consistent-import': ['error', { syntax: 'named' }],
                        'zod/prefer-strict-object': 'error',
                        'zod/prefer-meta-last': 'error',
                    },
                },
                calls: [{ name: 'addPlugins', args: [{ imports: { zod: 'zodPlugin' } }] }],
                presets: [{ importName: 'zodPlugin', path: 'configs.recommended', merge: 'rules' }],
            },
        ],
    };
}
