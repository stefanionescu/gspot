import { VAGUE_TEST_TITLE_WORDS } from '#cli/config/configurations/javascript.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

/**
Apply the Vitest recommended preset and the test rules to the test files.

@param scope the presets and file selectors of the scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIGURATION_BUILDERS calls it by configuration name, like every block builder.
export function buildVitestBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'level'>): ConfigurationBlocks {
    const { eslintFiles } = scope;
    return [
        {
            fields: {
                files: eslintFiles.tests,
                rules: {
                    'gspot/require-test-assertions': 'off',
                    'vitest/no-disabled-tests': 'error',
                    'vitest/prefer-strict-equal': 'error',
                    'vitest/no-focused-tests': ['error', { fixable: false }],
                    ...(scope.level === 'all' && {
                        'vitest/valid-title': ['error', { disallowedWords: VAGUE_TEST_TITLE_WORDS }],
                    }),
                    'vitest/prefer-vi-mocked': 'error',
                    'vitest/prefer-each': 'error',
                    'vitest/max-nested-describe': 'error',
                },
            },
            calls: [{ name: 'addPlugins', args: [{ plugins: ['@vitest/eslint-plugin'] }] }],
            presets: [{ package: '@vitest/eslint-plugin', path: 'configs.recommended', merge: 'rules' }],
        },
    ];
}
