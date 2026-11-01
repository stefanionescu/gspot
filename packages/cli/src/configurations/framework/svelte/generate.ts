import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

import {
    SVELTE_RULES,
    SVELTE_FILES,
    CONFIGURATION_PLUGINS,
    TYPESCRIPT_CONFIGURATION,
} from '#cli/config/configurations/framework.ts';

/**
Apply the Svelte presets and the Svelte component parser.

@param scope the planned ESLint file of the scope.
*/
export function buildSvelteBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const isTyped = scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    const blocks: ConfigurationBlocks['blocks'] = [
        { fields: {}, presets: [{ importName: 'sveltePlugin', path: 'configs.recommended', merge: 'spread' }] },
        {
            fields: {
                files: SVELTE_FILES,
                languageOptions: { parserOptions: { extraFileExtensions: ['.svelte'], sourceType: 'module' } },
                rules: SVELTE_RULES,
            },
            calls: [
                {
                    name: 'setComponentParser',
                    args: [
                        { importName: 'svelteParser' },
                        ...(isTyped ? [{ importName: 'tseslint', path: 'parser' }] : []),
                    ],
                },
            ],
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.svelte,
        blocks,
    };
}
