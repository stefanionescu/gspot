import { serializeBlocks } from '#cli/generation/eslint/print.ts';
import { FRAGMENT_SPACING } from '#cli/config/generation/eslint.ts';
import { VUE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';
import { pickPresetFields, promotePresetRules, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';

/**
 * Apply the Vue presets, accessibility lint rules, and component parsing.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildVueFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'blockWriter' | 'configurations'>,
): EslintFragment {
    const { eslintPresets, blockWriter, configurations } = context;

    const imports: string[] = [
        "import vuePlugin from 'eslint-plugin-vue';",
        "import vueParser from 'vue-eslint-parser';",
        "import vueAccessibility from 'eslint-plugin-vuejs-accessibility';",
    ];

    const output: string[] = [FRAGMENT_SPACING];
    const presets = eslintPresets.get('vue') as FragmentPresets;
    const typed = configurations.includes('typescript');
    output.push(
        serializeBlocks(blockWriter, buildArrayPresetBlocks(presets.recommended, 'vuePlugin', promotePresetRules)),
        serializeBlocks(
            blockWriter,
            buildArrayPresetBlocks(presets.accessibility, 'vueAccessibility', (block) => ({
                ...pickPresetFields(block),
                files: ['**/*.vue'],
            })),
        ),
        '\n',
        blockWriter.block(
            {
                files: ['**/*.vue'],
                rules: {
                    ...(typed
                        ? { 'vue/define-props-declaration': 'error', 'vue/define-emits-declaration': 'error' }
                        : {}),
                    ...VUE_RULES,
                },
            },
            `languageOptions: { parser: vueParser, parserOptions: { ${typed ? 'parser: { ts: tseslint.parser, typescript: tseslint.parser },' : ''} extraFileExtensions: ['.vue'], sourceType: 'module' } }`,
        ),
        ',\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildVueFragment };
