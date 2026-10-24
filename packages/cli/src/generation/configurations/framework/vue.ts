import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { VUE_RULES, VUE_FILES } from '#cli/config/generation/configurations/framework/vue.ts';

import {
    getPreset,
    convertPresetWarnings,
    buildArrayPresetBlocks,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import {
    CONFIGURATION_PLUGINS,
    TYPESCRIPT_CONFIGURATION,
} from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
Apply the Vue presets, accessibility lint rules, and component parsing.

@param scope the planned ESLint file of the scope.
@returns the imports and ESLint blocks for this configuration.
*/
export function buildVueBlocks(scope: Pick<EslintScope, 'presets' | 'settings'>): ConfigurationBlocks {
    const { presets, settings } = scope;
    const recommended = getPreset(presets, 'recommended');
    const accessibility = getPreset(presets, 'accessibility');
    const blocks: ConfigurationBlocks['blocks'] = [];
    const typed = settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    blocks.push(
        ...buildArrayPresetBlocks(recommended, 'vuePlugin', convertPresetWarnings),
        ...buildArrayPresetBlocks(accessibility, 'vueAccessibility', (block) => {
            const { parser: _parser, ...fields } = block;
            return { ...fields, files: VUE_FILES };
        }),
        {
            fields: {
                files: VUE_FILES,
                rules: {
                    ...(typed
                        ? { 'vue/define-props-declaration': 'error', 'vue/define-emits-declaration': 'error' }
                        : {}),
                    ...VUE_RULES,
                },
            },
            properties: `languageOptions: { parser: vueParser, parserOptions: { ${typed ? 'parser: { ts: tseslint.parser, typescript: tseslint.parser },' : ''} extraFileExtensions: ['.vue'], sourceType: 'module' } }`,
        },
    );
    return {
        imports: CONFIGURATION_PLUGINS['vue'],
        blocks,
    };
}
