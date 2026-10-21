import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { getPreset, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';
import { REACT_RULES, JSX_CODE_FILES, FRAGMENT_IMPORTS } from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply the React, hooks, and refresh lint rules for the JSX mode.
 *
 * @param context the presets and the block writer.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildReactFragment(context: Pick<EslintFragmentContext, 'presets'>): EslintFragment {
    const { presets } = context;
    const recommended = getPreset(presets, 'recommended');
    const jsx = getPreset(presets, 'jsx');
    const hooks = getPreset(presets, 'hooks');
    const refresh = getPreset(presets, 'refresh');
    const blocks: EslintFragment['blocks'] = [
        {
            data: {
                files: JSX_CODE_FILES,
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
        imports: FRAGMENT_IMPORTS['react'],
        blocks,
    };
}
export { buildReactFragment };
