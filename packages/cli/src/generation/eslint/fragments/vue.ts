import { serializeBlocks } from '#cli/generation/eslint/print.ts';
import { FRAGMENT_SPACING } from '#cli/config/generation/eslint.ts';
import { VUE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { pickPresetFields, buildPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply Vue presets, accessibility rules, and component parsing.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildVueFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'eslintModule' | 'configurations'>,
): EslintFragment {
    const { eslintPresets, eslintModule, configurations } = context;

    const imports: string[] = [
        "import vuePlugin from 'eslint-plugin-vue';",
        "import vueParser from 'vue-eslint-parser';",
        "import vueAccessibility from 'eslint-plugin-vuejs-accessibility';",
    ];

    const output: string[] = [FRAGMENT_SPACING];
    const presets = eslintPresets.get('vue') as FragmentPresets;
    const typed = configurations.includes('typescript');
    output.push(
        serializeBlocks(
            eslintModule,
            buildPresetBlocks(presets.recommended, 'vuePlugin', (block, index, source) => [
                {
                    ...pickPresetFields(block),
                    ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
                },
                `...${source}[${String(index)}]`,
                {
                    expression: `${source}[${String(index)}].rules`,
                    rules: block.rules,
                },
            ]),
        ),
        serializeBlocks(
            eslintModule,
            buildPresetBlocks(presets.accessibility, 'vueAccessibility', (block, index, source) => [
                { ...pickPresetFields(block), files: ['**/*.vue'] },
                `...${source}[${String(index)}]`,
                {
                    expression: `${source}[${String(index)}].rules`,
                    rules: block.rules,
                },
            ]),
        ),
        '\n',
        eslintModule.block(
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
