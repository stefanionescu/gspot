import { JEST_GLOBAL_PACKAGE } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment } from '#cli/types/generation/eslint.ts';

/**
 * Apply Jest rules with the selected test files and globals.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildJestFragment(
    context: Pick<EslintContext, 'eslintModule' | 'eslintFiles' | 'testRuleNames'>,
): EslintFragment {
    const { eslintModule, eslintFiles, testRuleNames } = context;

    const imports: string[] = ["import jest from 'eslint-plugin-jest';"];

    const output: string[] = [
        '\n',
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
    return { imports: imports, blocks: output.join('') };
}
