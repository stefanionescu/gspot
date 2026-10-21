import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';
import { VUE_RULES, VUE_FILES, FRAGMENT_IMPORTS } from '#cli/config/generation/eslint-fragments.ts';
import { getPreset, promotePresetRules, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';

/**
 * Apply the Vue presets, accessibility lint rules, and component parsing.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildVueFragment(context: Pick<EslintFragmentContext, 'presets' | 'view'>): EslintFragment {
    const { presets, view } = context;
    const recommended = getPreset(presets, 'recommended');
    const accessibility = getPreset(presets, 'accessibility');
    const blocks: EslintFragment['blocks'] = [];
    const typed = view.configurations.includes(TYPESCRIPT_CONFIGURATION);
    blocks.push(
        ...buildArrayPresetBlocks(recommended, 'vuePlugin', promotePresetRules),
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
        imports: FRAGMENT_IMPORTS['vue'],
        blocks,
    };
}
export { buildVueFragment };
