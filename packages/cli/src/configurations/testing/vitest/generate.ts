import { CONFIGURATION_PLUGINS } from '#cli/config/configurations/framework.ts';
import { VAGUE_TEST_TITLE_WORDS } from '#cli/config/configurations/javascript.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

/**
Apply the Vitest recommended preset and the test rules to the test files.

@param scope the presets and file selectors of the scope.
*/
export function buildVitestBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'level'>): ConfigurationBlocks {
    const { eslintFiles } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [
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
            calls: [{ name: 'addPlugins', args: [{ imports: { vitest: 'vitest' } }] }],
            presets: [{ importName: 'vitest', path: 'configs.recommended', merge: 'rules' }],
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.vitest,
        blocks,
    };
}
