import { getPreset, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';
import { TEST_RULE_NAMES, FRAGMENT_IMPORTS } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';

/**
 * Apply the Vitest presets to the test files.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildVitestFragment(context: Pick<EslintFragmentContext, 'presets' | 'eslintFiles'>): EslintFragment {
    const { presets, eslintFiles } = context;
    const blocks: EslintFragment['blocks'] = [];
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
        imports: FRAGMENT_IMPORTS['vitest'],
        blocks,
    };
}
export { buildVitestFragment };
