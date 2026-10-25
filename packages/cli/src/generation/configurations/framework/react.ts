import { REACT_RULES } from '#cli/config/generation/configurations/framework/react.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { serializePresetAccess } from '#cli/generation/configurations/language/javascript/eslint/print.ts';

import {
    REACT_FILES,
    CONFIGURATION_PLUGINS,
} from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';
import {
    getPreset,
    convertWarningsToErrors,
    buildPresetRuleExpression,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the React, hooks, and refresh lint rules for the JSX mode.

@param scope the presets of the scope.
@returns the imports and ESLint blocks for this configuration.
*/
export function buildReactBlocks(scope: Pick<EslintScope, 'presets'>): ConfigurationBlocks {
    const { presets } = scope;
    const recommended = getPreset(presets, 'recommended');
    const hooks = getPreset(presets, 'hooks');
    const refresh = getPreset(presets, 'refresh');
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: {
                files: REACT_FILES,
                rules: {
                    ...(recommended.blocks[0].rules !== undefined &&
                        convertWarningsToErrors(recommended.blocks[0].rules)),
                    ...(hooks.blocks[0].rules !== undefined && convertWarningsToErrors(hooks.blocks[0].rules)),
                    ...refresh.blocks[0].rules,
                    ...REACT_RULES,
                },
            },
            properties: `plugins: { 'react-hooks': reactHooks, '@eslint-react': react, 'react-refresh': reactRefresh }, languageOptions: ${serializePresetAccess('react', recommended.source)}.languageOptions, settings: ${serializePresetAccess('react', recommended.source)}.settings`,
            preset: buildPresetRuleExpression([
                ['react', recommended],
                ['reactHooks', hooks],
                ['reactRefresh', refresh],
            ]),
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS['react'],
        blocks,
    };
}
