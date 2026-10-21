import { FRAGMENT_IMPORTS } from '#cli/config/generation/eslint-fragments.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { getPreset, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';
import type { EslintFragment, EslintFragmentContext } from '#cli/types/generation/eslint.ts';

/**
 * Apply the TanStack Query presets with enabled warnings raised to errors.
 *
 * @param context the preset exports and code selectors.
 * @returns imported bindings and unscoped block data.
 */
function buildTanstackQueryFragment(context: Pick<EslintFragmentContext, 'presets' | 'eslintFiles'>): EslintFragment {
    const { presets, eslintFiles } = context;
    const recommended = getPreset(presets, 'recommended');
    return {
        imports: FRAGMENT_IMPORTS['tanstack-query'],
        blocks: buildArrayPresetBlocks(recommended, 'tanstackQuery', ({ rules }) => ({
            files: eslintFiles.code,
            ...(rules === undefined ? {} : { rules: convertWarningsToErrors(rules) }),
        })),
    };
}

export { buildTanstackQueryFragment };
