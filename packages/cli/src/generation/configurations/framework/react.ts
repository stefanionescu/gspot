import { REACT_RULES } from '#cli/config/generation/configurations/framework/react.ts';
import { REACT_FILES } from '#cli/config/generation/configurations/framework/nextjs.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    getPreset,
    buildPresetRules,
    convertWarningsToErrors,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the React, hooks, and refresh lint rules for the JSX mode.

@param scope the presets of the scope.
*/
export function buildReactBlocks(scope: Pick<EslintScope, 'presets'>): ConfigurationBlocks {
    const { presets } = scope;
    const recommended = getPreset(presets, 'recommended');
    const hooks = getPreset(presets, 'hooks');
    const refresh = getPreset(presets, 'refresh');
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: {
                files: REACT_FILES,
                rules: {
                    ...(recommended.blocks[0].rules !== undefined &&
                        convertWarningsToErrors(recommended.blocks[0].rules)),
                    ...(hooks.blocks[0].rules !== undefined && convertWarningsToErrors(hooks.blocks[0].rules)),
                    ...refresh.blocks[0].rules,
                    ...REACT_RULES,
                },
            },
            calls: [
                {
                    name: 'addPlugins',
                    args: [
                        {
                            imports: {
                                'react-hooks': 'reactHooks',
                                '@eslint-react': 'react',
                                'react-refresh': 'reactRefresh',
                            },
                        },
                    ],
                },
            ],
            preset: {
                ...buildPresetRules([
                    ['react', recommended],
                    ['reactHooks', hooks],
                    ['reactRefresh', refresh],
                ]),
                sources: [
                    { importName: 'react', path: recommended.source, includeFields: true },
                    { importName: 'reactHooks', path: hooks.source },
                    { importName: 'reactRefresh', path: refresh.source },
                ],
            },
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS['react'],
        blocks,
    };
}
