import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { SVELTE_RULES, SVELTE_FILES } from '#cli/config/generation/configurations/framework/svelte.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    getPreset,
    buildArrayPresetBlocks,
    convertWarningsToErrors,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the Svelte presets and the Svelte component parser.

@param scope the planned ESLint file of the scope.
*/
export function buildSvelteBlocks(scope: Pick<EslintScope, 'presets' | 'settings'>): ConfigurationBlocks {
    const { presets, settings } = scope;
    const recommended = getPreset(presets, 'recommended');
    const isTyped = settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    const blocks: ConfigurationBlocks['blocks'] = [
        ...buildArrayPresetBlocks(recommended, 'sveltePlugin', (block) => {
            const { parser: _parser, ...fields } = block;
            return { ...fields, ...(block.rules !== undefined && { rules: convertWarningsToErrors(block.rules) }) };
        }),
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
