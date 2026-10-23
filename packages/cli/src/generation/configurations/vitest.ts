import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';

import {
    getPreset,
    buildPresetRuleExpression,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import {
    TEST_RULE_NAMES,
    CONFIGURATION_PLUGINS,
} from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
 * Apply the typed presets and the project files.
 *
 * @param scope the planned ESLint file of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildVitestBlocks(scope: Pick<EslintScope, 'presets' | 'eslintFiles'>): ConfigurationBlocks {
    const { presets, eslintFiles } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [];
    const preset = getPreset(presets, 'recommended');
    blocks.push({
        fields: {
            files: eslintFiles.tests,
            rules: {
                ...preset.blocks[0].rules,
                ...Object.fromEntries(TEST_RULE_NAMES.map((name) => [`vitest/${name}`, 'error'])),
                'vitest/no-focused-tests': ['error', { fixable: false }],
            },
        },
        properties: 'plugins: { vitest }',
        preset: buildPresetRuleExpression([['vitest', preset]]),
    });
    return {
        imports: CONFIGURATION_PLUGINS['vitest'],
        blocks,
    };
}
