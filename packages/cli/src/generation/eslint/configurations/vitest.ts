import { getPreset, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { TEST_RULE_NAMES, CONFIGURATION_PLUGINS } from '#cli/config/generation/eslint/configurations.ts';

/**
 * Apply the Vitest presets to the test files.
 *
 * @param scope the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildVitestBlocks(scope: Pick<EslintScope, 'presets' | 'eslintFiles'>): ConfigurationBlocks {
    const { presets, eslintFiles } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [];
    const preset = getPreset(presets, 'recommended');
    blocks.push({
        data: {
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
