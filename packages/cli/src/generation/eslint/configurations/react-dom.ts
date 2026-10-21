import { REACT_NATIVE_CONFIGURATION } from '#cli/config/configurations.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { REACT_FILES, CONFIGURATION_PLUGINS } from '#cli/config/generation/eslint/configurations.ts';
import { getPreset, allowFocusableRegions, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';

/**
 * Apply the accessibility lint rules to the React DOM files.
 *
 * @param scope the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildReactDomBlocks(scope: Pick<EslintScope, 'presets' | 'settings'>): ConfigurationBlocks {
    const { presets, settings } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [];
    if (!settings.configurations.includes(REACT_NATIVE_CONFIGURATION)) {
        const preset = getPreset(presets, 'accessibility');
        blocks.push({
            data: {
                files: REACT_FILES,
                ...(preset.blocks[0].rules === undefined
                    ? {}
                    : { rules: allowFocusableRegions(preset.blocks[0].rules) }),
            },
            properties: "plugins: { 'jsx-a11y': accessibility }",
            preset: buildPresetRuleExpression([['accessibility', preset]]),
        });
    }
    return {
        imports: CONFIGURATION_PLUGINS['react-dom'],
        blocks,
    };
}
