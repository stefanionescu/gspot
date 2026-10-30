import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';

import {
    TEST_RULE_NAMES,
    CONFIGURATION_PLUGINS,
} from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';

/**
Apply the Vitest recommended preset and the test rules to the test files.

@param scope the presets and file selectors of the scope.
*/
export function buildVitestBlocks(scope: Pick<EslintScope, 'eslintFiles'>): ConfigurationBlocks {
    const { eslintFiles } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: {
                files: eslintFiles.tests,
                rules: {
                    'sonarjs/assertions-in-tests': 'off',
                    ...Object.fromEntries(TEST_RULE_NAMES.map((name) => [`vitest/${name}`, 'error'])),
                    'vitest/no-focused-tests': ['error', { fixable: false }],
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
