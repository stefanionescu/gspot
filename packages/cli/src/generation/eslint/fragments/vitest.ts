import { presetSource } from '#cli/generation/eslint/serialize.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write vitest ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.testRuleNames the retained test lint rule names.
 *
 * @returns the ESLint fragment source.
 */
export function vitestFragment({
    eslintPresets,
    eslintModule,
    eslintFiles,
    testRuleNames,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'eslintFiles' | 'testRuleNames'>): string {
    const output: string[] = ["import vitest from '@vitest/eslint-plugin';\n"];
    const preset = (eslintPresets('vitest') as FragmentPresets).recommended;
    output.push(
        eslintModule.block(
            {
                files: eslintFiles.tests,
                rules: {
                    ...preset.blocks[0].rules,
                    ...Object.fromEntries(testRuleNames.map((name) => [`vitest/${name}`, 'error'])),
                    'vitest/no-focused-tests': ['error', { fixable: false }],
                },
            },
            'plugins: { vitest }',
            { expression: `${presetSource('vitest', preset.source)}.rules`, rules: preset.blocks[0].rules },
        ),
        ',\n',
    );
    return output.join('');
}
