import { ZOD_RULES } from '#cli/config/generation/eslint-fragments.ts';
import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write zod ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function zodFragment({
    eslintModule,
    eslintFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles'>): string {
    const output: string[] = [
        "import zodPlugin from 'eslint-plugin-zod';\n",
        eslintModule.block(
            {
                files: eslintFiles.code,
                rules: Object.fromEntries(ZOD_RULES.map((rule) => [`zod/${rule}`, 'error'])),
            },
            'plugins: { zod: zodPlugin }',
        ),
        ',\n',
    ];
    return output.join('');
}
