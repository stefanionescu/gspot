import { EXPRESS_RULES } from '#cli/config/generation/eslint-fragments.ts';
import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write express ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function expressFragment({
    eslintModule,
    eslintFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles'>): string {
    const output: string[] = [
        eslintModule.block({
            files: eslintFiles.code,
            rules: EXPRESS_RULES,
        }),
        ',\n',
    ];
    return output.join('');
}
