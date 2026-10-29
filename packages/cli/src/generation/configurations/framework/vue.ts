import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { VUE_RULES, VUE_FILES } from '#cli/config/generation/configurations/framework/vue.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    getPreset,
    buildArrayPresetBlocks,
    convertWarningsToErrors,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the Vue presets, accessibility lint rules, and component parsing.

@param scope the planned ESLint file of the scope.
*/
export function buildVueBlocks(scope: Pick<EslintScope, 'presets' | 'settings'>): ConfigurationBlocks {
    const { presets, settings } = scope;
    const recommended = getPreset(presets, 'recommended');
    const accessibility = getPreset(presets, 'accessibility');
    const isTyped = settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    const blocks: ConfigurationBlocks['blocks'] = [
        ...buildArrayPresetBlocks(recommended, 'vuePlugin', (block) => {
            const { parser: _parser, ...fields } = block;
            return { ...fields, ...(block.rules !== undefined && { rules: convertWarningsToErrors(block.rules) }) };
        }),
        ...buildArrayPresetBlocks(accessibility, 'vueAccessibility', (block) => {
            const { parser: _parser, ...fields } = block;
            return { ...fields, files: VUE_FILES };
        }),
        {
            fields: {
                files: VUE_FILES,
                languageOptions: { parserOptions: { extraFileExtensions: ['.vue'], sourceType: 'module' } },
                rules: {
                    ...(isTyped && {
                        'vue/define-props-declaration': 'error',
                        'vue/define-emits-declaration': 'error',
                    }),
                    ...VUE_RULES,
                },
            },
            calls: [
                {
                    name: 'setComponentParser',
                    args: [
                        { importName: 'vueParser' },
                        ...(isTyped ? [{ importName: 'tseslint', path: 'parser' }] : []),
                    ],
                },
            ],
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.vue,
        blocks,
    };
}
