import { presetBlock } from '#cli/generation/eslint/presets.ts';
import { presetSource, eslintErrorRules } from '#cli/generation/eslint/serialize.ts';
import { SVELTE_FILES, SVELTE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write svelte ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.configurations the selected configuration names.
 *
 * @returns the ESLint fragment source.
 */
export function svelteFragment({
    eslintPresets,
    eslintModule,
    configurations,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'configurations'>): string {
    const output: string[] = [
        "import sveltePlugin from 'eslint-plugin-svelte';\nimport svelteParser from 'svelte-eslint-parser';\n",
    ];
    const presets = eslintPresets('svelte') as FragmentPresets;
    const typed = configurations.includes('typescript');
    for (const [index, block] of presets.recommended.blocks.entries()) {
        output.push(
            '\n',
            eslintModule.block(
                {
                    ...presetBlock(block),
                    ...(block.rules === undefined ? {} : { rules: eslintErrorRules(block.rules) }),
                },
                `...${presetSource('sveltePlugin', presets.recommended.source)}[${String(index)}]`,
                {
                    expression: `${presetSource('sveltePlugin', presets.recommended.source)}[${String(index)}].rules`,
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
                files: SVELTE_FILES,
                rules: SVELTE_RULES,
            },
            `languageOptions: { parser: svelteParser, parserOptions: { ${typed ? 'parser: { ts: tseslint.parser, typescript: tseslint.parser },' : ''} extraFileExtensions: ['.svelte'] } }`,
        ),
        ',\n',
    );
    return output.join('');
}
