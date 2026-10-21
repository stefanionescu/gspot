import { REACT_NATIVE_CONFIGURATION } from '#cli/config/configurations.ts';
import { JSX_CODE_FILES, FRAGMENT_IMPORTS } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';
import { getPreset, allowFocusableRegions, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';

/**
 * Apply the accessibility lint rules to the React DOM files.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildReactDomFragment(context: Pick<EslintFragmentContext, 'presets' | 'view'>): EslintFragment {
    const { presets, view } = context;
    const blocks: EslintFragment['blocks'] = [];
    if (!view.configurations.includes(REACT_NATIVE_CONFIGURATION)) {
        const preset = getPreset(presets, 'accessibility');
        blocks.push({
            data: {
                files: JSX_CODE_FILES,
                ...(preset.blocks[0].rules === undefined
                    ? {}
                    : { rules: allowFocusableRegions(preset.blocks[0].rules) }),
            },
            properties: "plugins: { 'jsx-a11y': accessibility }",
            preset: buildPresetRuleExpression([['accessibility', preset]]),
        });
    }
    return {
        imports: FRAGMENT_IMPORTS['react-dom'],
        blocks,
    };
}
export { buildReactDomFragment };
