import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { getPreset, buildPresetRules } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

import {
    TEST_RULE_NAMES,
    CONFIGURATION_PLUGINS,
} from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
Apply the Vitest recommended preset and the test rules to the test files.

@param scope the presets and file selectors of the scope.
*/
export function buildVitestBlocks(scope: Pick<EslintScope, 'presets' | 'eslintFiles'>): ConfigurationBlocks {
    const { presets, eslintFiles } = scope;
    const preset = getPreset(presets, 'recommended');
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: {
                files: eslintFiles.tests,
                rules: {
                    'sonarjs/assertions-in-tests': 'off',
                    ...preset.blocks[0].rules,
                    ...Object.fromEntries(TEST_RULE_NAMES.map((name) => [`vitest/${name}`, 'error'])),
                    'vitest/no-focused-tests': ['error', { fixable: false }],
                },
            },
            calls: [{ name: 'addPlugins', args: [{ imports: { vitest: 'vitest' } }] }],
            preset: buildPresetRules([['vitest', preset]]),
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.vitest,
        blocks,
    };
}
