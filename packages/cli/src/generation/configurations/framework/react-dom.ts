import { REACT_NATIVE_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { REACT_FILES } from '#cli/config/generation/configurations/framework/nextjs.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    getPreset,
    buildPresetRules,
    setFocusableRoles,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the accessibility lint rules to the React DOM files.

@param scope the planned ESLint file of the scope.
*/
export function buildReactDomBlocks(scope: Pick<EslintScope, 'presets' | 'settings'>): ConfigurationBlocks {
    const { presets, settings } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [];
    if (!settings.configurations.includes(REACT_NATIVE_CONFIGURATION)) {
        const preset = getPreset(presets, 'accessibility');
        blocks.push({
            fields: {
                files: REACT_FILES,
                ...(preset.blocks[0].rules !== undefined && {
                    rules: setFocusableRoles(preset.blocks[0].rules),
                }),
            },
            calls: [{ name: 'addPlugins', args: [{ imports: { 'jsx-a11y-x': 'accessibility' } }] }],
            preset: buildPresetRules([['accessibility', preset]]),
        });
    }
    return {
        imports: CONFIGURATION_PLUGINS['react-dom'],
        blocks,
    };
}
