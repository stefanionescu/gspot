import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
import { JEST_GLOBAL_PACKAGE } from '#cli/config/generation/eslint-fragments.ts';
/**
 * Write jest ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.testRuleNames the retained test lint rule names.
 *
 * @returns the ESLint fragment source.
 */
export function jestFragment({
    eslintModule,
    eslintFiles,
    testRuleNames,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles' | 'testRuleNames'>): string {
    const output: string[] = [
        "import jest from 'eslint-plugin-jest';\n",
        eslintModule.block(
            {
                files: eslintFiles.tests,
                rules: {
                    ...Object.fromEntries(testRuleNames.map((name) => [`jest/${name}`, 'error'])),
                    'jest/valid-expect': ['error', { maxArgs: 1 }],
                },
            },
            `plugins: { jest }, languageOptions: { globals: jest.environments.globals.globals }, settings: { jest: { globalPackage: ${JSON.stringify(JEST_GLOBAL_PACKAGE)} } }`,
        ),
        ',\n',
    ];
    return output.join('');
}
