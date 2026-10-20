import { TEST_RULE_NAMES } from '#cli/config/generation/eslint.ts';
import { JEST_GLOBAL_PACKAGE } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment } from '#cli/types/generation/eslint.ts';

/**
 * Apply the Jest lint rules with the test files and globals of the scope.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildJestFragment(context: Pick<EslintContext, 'blockWriter' | 'eslintFiles'>): EslintFragment {
    const { blockWriter, eslintFiles } = context;

    const imports: string[] = ["import jest from 'eslint-plugin-jest';"];

    const output: string[] = [
        '\n',
        blockWriter.block(
            {
                files: eslintFiles.tests,
                rules: {
                    ...Object.fromEntries(TEST_RULE_NAMES.map((name) => [`jest/${name}`, 'error'])),
                    'jest/valid-expect': ['error', { maxArgs: 1 }],
                },
            },
            `plugins: { jest }, languageOptions: { globals: jest.environments.globals.globals }, settings: { jest: { globalPackage: ${JSON.stringify(JEST_GLOBAL_PACKAGE)} } }`,
        ),
        ',\n',
    ];
    return { imports: imports, blocks: output.join('') };
}

export { buildJestFragment };
