import { presetSource, eslintErrorRules } from '#cli/generation/eslint/serialize.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write tanstackQuery ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.eslintPresets the declared ESLint preset reader.
 *
 * @returns the ESLint fragment source.
 */
export function tanstackQueryFragment({
    eslintModule,
    eslintFiles,
    eslintPresets,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles' | 'eslintPresets'>): string {
    const output: string[] = ["import tanstackQuery from '@tanstack/eslint-plugin-query';\n"];
    const preset = (eslintPresets('tanstack-query') as FragmentPresets).recommended;
    for (const [index, { rules }] of preset.blocks.entries()) {
        output.push(
            '\n',
            eslintModule.block(
                { files: eslintFiles.code, ...(rules === undefined ? {} : { rules: eslintErrorRules(rules) }) },
                "plugins: { '@tanstack/query': tanstackQuery }",
                { expression: `${presetSource('tanstackQuery', preset.source)}[${String(index)}].rules`, rules },
            ),
            ',\n',
        );
    }
    output.push('\n');
    return output.join('');
}
