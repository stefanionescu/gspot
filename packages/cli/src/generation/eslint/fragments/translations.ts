import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
import { JSX_FILES, TRANSLATIONS_RULES } from '#cli/config/generation/eslint-fragments.ts';

/**
 * Write translations ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.testFiles the root-relative test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function translationsFragment({
    eslintModule,
    testFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'testFiles'>): string {
    const output: string[] = ["import i18next from 'eslint-plugin-i18next';\n"];
    {
        output.push(
            '\n',
            eslintModule.block(
                {
                    files: JSX_FILES,
                    ignores: testFiles,
                    rules: TRANSLATIONS_RULES,
                },
                'plugins: { i18next }',
            ),
            ',\n',
        );
    }
    output.push('\n');
    return output.join('');
}
