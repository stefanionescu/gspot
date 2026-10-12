import { EXPO_RULES } from '#cli/config/generation/eslint-fragments.ts';
import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write expo ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function expoFragment({
    eslintModule,
    eslintFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles'>): string {
    const output: string[] = [
        "import expoPlugin from 'eslint-plugin-expo';\n",
        eslintModule.block(
            {
                files: eslintFiles.code,
                rules: EXPO_RULES,
            },
            'plugins: { expo: expoPlugin }',
        ),
        ',\n',
    ];
    return output.join('');
}
