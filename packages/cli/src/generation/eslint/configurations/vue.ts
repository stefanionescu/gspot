import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { getPreset, convertPresetWarnings, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { VUE_RULES, VUE_FILES, CONFIGURATION_PLUGINS } from '#cli/config/generation/eslint/configurations.ts';

/**
 * Apply the Vue presets, accessibility lint rules, and component parsing.
 *
 * @param scope the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
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
            data: {
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
