import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';
import { SVELTE_FILES, SVELTE_RULES, FRAGMENT_IMPORTS } from '#cli/config/generation/eslint-fragments.ts';
import { getPreset, promotePresetRules, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';

/**
 * Apply the Svelte presets and typed component parsing.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildSvelteFragment(context: Pick<EslintFragmentContext, 'presets' | 'view'>): EslintFragment {
    const { presets, view } = context;
    const recommended = getPreset(presets, 'recommended');
    const blocks: EslintFragment['blocks'] = [];
    const typed = view.configurations.includes(TYPESCRIPT_CONFIGURATION);
    blocks.push(...buildArrayPresetBlocks(recommended, 'sveltePlugin', promotePresetRules), {
        data: {
            files: SVELTE_FILES,
            rules: SVELTE_RULES,
        },
        properties: `languageOptions: { parser: svelteParser, parserOptions: { ${typed ? 'parser: { ts: tseslint.parser, typescript: tseslint.parser },' : ''} extraFileExtensions: ['.svelte'] } }`,
    });
    return {
        imports: FRAGMENT_IMPORTS['svelte'],
        blocks,
    };
}
export { buildSvelteFragment };
