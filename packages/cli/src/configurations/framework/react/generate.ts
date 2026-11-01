import type { ConfigurationBlocks } from '#cli/types/configurations/language.ts';
import { REACT_RULES, REACT_FILES, CONFIGURATION_PLUGINS } from '#cli/config/configurations/framework.ts';

/**
Apply the React, hooks, and refresh lint rules for the JSX mode.

@returns the plugins and the block of the React files.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The configuration builder table or shared block builders call this function.
export function buildReactBlocks(): ConfigurationBlocks {
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: { files: REACT_FILES, rules: REACT_RULES },
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
            presets: [
                { importName: 'react', path: 'configs.recommended', merge: 'fields' },
                { importName: 'reactHooks', path: 'configs.flat.recommended-latest', merge: 'rules' },
                { importName: 'reactRefresh', path: 'configs.recommended', merge: 'rules' },
            ],
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS['react'],
        blocks,
    };
}
