import { pickPresetFields } from '#cli/generation/eslint/presets.ts';
import { VUE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write vue ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.configurations the selected configuration names.
 *
 * @returns the ESLint fragment source.
 */
export function buildVueFragment({
    eslintPresets,
    eslintModule,
    configurations,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'configurations'>): string {
    const output: string[] = [
        "import vuePlugin from 'eslint-plugin-vue';\nimport vueParser from 'vue-eslint-parser';\nimport vueAccessibility from 'eslint-plugin-vuejs-accessibility';\n",
    ];
    const presets = eslintPresets('vue') as FragmentPresets;
    const typed = configurations.includes('typescript');
    for (const [index, block] of presets.recommended.blocks.entries()) {
        output.push(
            '\n',
            eslintModule.block(
                {
                    ...pickPresetFields(block),
                    ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
                },
                `...${serializePresetAccess('vuePlugin', presets.recommended.source)}[${String(index)}]`,
                {
                    expression: `${serializePresetAccess('vuePlugin', presets.recommended.source)}[${String(index)}].rules`,
                    rules: block.rules,
                },
            ),
            ',\n',
        );
    }
    for (const [index, block] of presets.accessibility.blocks.entries()) {
        output.push(
            '\n',
            eslintModule.block(
                { ...pickPresetFields(block), files: ['**/*.vue'] },
                `...${serializePresetAccess('vueAccessibility', presets.accessibility.source)}[${String(index)}]`,
                {
                    expression: `${serializePresetAccess('vueAccessibility', presets.accessibility.source)}[${String(index)}].rules`,
                    rules: block.rules,
                },
            ),
            ',\n',
        );
    }
    output.push(
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
    return output.join('');
}
