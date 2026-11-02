import type { ConfigurationBlocks } from '#cli/types/configurations/language.ts';
import { REACT_RULES, REACT_FILES, CONFIGURATION_PLUGINS } from '#cli/config/configurations/framework.ts';

/**
Apply the React, hooks, and refresh lint rules for the JSX mode.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIGURATION_BUILDERS calls it by configuration name, like every block builder.
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
