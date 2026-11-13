import { VAGUE_TEST_TITLE_WORDS } from '#cli/config/configurations/javascript/eslint-config.ts';
import type { EslintBlockBuilder } from '#cli/types/configurations/javascript.ts';

export const VITEST_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
    vitest: (scope) => {
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
    },
};
