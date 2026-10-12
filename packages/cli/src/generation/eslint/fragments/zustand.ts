import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
import { ZUSTAND_STORE_CREATORS } from '#cli/config/generation/eslint-fragments.ts';
/**
 * Write zustand ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.roles the architecture role selectors.
 * @param root0.eslint the resolved ESLint configuration reader.
 *
 * @returns the ESLint fragment source.
 */
export function zustandFragment({
    eslintModule,
    eslintFiles,
    roles,
    eslint,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles' | 'roles' | 'eslint'>): string {
    const output: string[] = [
        '\n',
        eslintModule.block({
            files: eslintFiles.code,
            ignores: roles.stores,
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        paths: [
                            ...eslint().restrictedImports,
                            {
                                name: 'zustand',
                                importNames: ZUSTAND_STORE_CREATORS,
                                message:
                                    'Create the store inside a factory that a provider owns, not as a module-level store.',
                            },
                        ],
                    },
                ],
            },
        }),
        ',\n\n',
    ];
    return output.join('');
}
