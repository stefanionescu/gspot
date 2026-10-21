import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { getPreset, convertPresetWarnings, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { SVELTE_FILES, SVELTE_RULES, CONFIGURATION_PLUGINS } from '#cli/config/generation/eslint/configurations.ts';

/**
 * Apply the Svelte presets and typed component parsing.
 *
 * @param scope the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildSvelteBlocks(scope: Pick<EslintScope, 'presets' | 'view'>): ConfigurationBlocks {
    const { presets, view } = scope;
    const recommended = getPreset(presets, 'recommended');
    const blocks: ConfigurationBlocks['blocks'] = [];
    const typed = view.configurations.includes(TYPESCRIPT_CONFIGURATION);
    blocks.push(...buildArrayPresetBlocks(recommended, 'sveltePlugin', convertPresetWarnings), {
        data: {
            files: SVELTE_FILES,
            rules: SVELTE_RULES,
        },
        properties: `languageOptions: { parser: svelteParser, parserOptions: { ${typed ? 'parser: { ts: tseslint.parser, typescript: tseslint.parser },' : ''} extraFileExtensions: ['.svelte'] } }`,
    });
    return {
        imports: CONFIGURATION_PLUGINS['svelte'],
        blocks,
    };
}
