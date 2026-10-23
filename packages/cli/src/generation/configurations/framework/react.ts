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
 * Apply the React, hooks, and refresh lint rules for the JSX mode.
 *
 * @param scope the presets and the block writer.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildReactBlocks(scope: Pick<EslintScope, 'presets'>): ConfigurationBlocks {
    const { presets } = scope;
    const recommended = getPreset(presets, 'recommended');
    const jsx = getPreset(presets, 'jsx');
    const hooks = getPreset(presets, 'hooks');
    const refresh = getPreset(presets, 'refresh');
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            data: {
                files: REACT_FILES,
                rules: {
                    ...recommended.blocks[0].rules,
                    ...jsx.blocks[0].rules,
                    ...(hooks.blocks[0].rules === undefined ? {} : convertWarningsToErrors(hooks.blocks[0].rules)),
                    ...refresh.blocks[0].rules,
                    ...REACT_RULES,
                },
            },
            properties: `plugins: { 'react-hooks': reactHooks, react, 'react-refresh': reactRefresh }, languageOptions: ${serializePresetAccess('react', recommended.source)}.languageOptions, settings: { react: { version: 'detect' } }`,
            preset: buildPresetRuleExpression([
                ['react', recommended],
                ['react', jsx],
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
