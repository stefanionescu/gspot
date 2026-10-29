import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { getPreset, buildPresetRules } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
Apply the basic rules and strict schema conventions of Zod.

@param scope the preset and code files of the scope.
@returns the imported plugin and its rule block.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The configuration builder table or shared block builders call this function.
export function buildZodBlocks(scope: Pick<EslintScope, 'presets' | 'eslintFiles'>): ConfigurationBlocks {
    const preset = getPreset(scope.presets, 'recommended');
    return {
        imports: CONFIGURATION_PLUGINS.zod,
        blocks: [
            {
                fields: {
                    files: scope.eslintFiles.code,
                    rules: {
                        ...preset.blocks[0].rules,
                        'zod/prefer-strict-object': 'error',
                        'zod/prefer-meta-last': 'error',
                    },
                },
                calls: [{ name: 'addPlugins', args: [{ imports: { zod: 'zodPlugin' } }] }],
                preset: buildPresetRules([['zodPlugin', preset]]),
            },
        ],
    };
}
