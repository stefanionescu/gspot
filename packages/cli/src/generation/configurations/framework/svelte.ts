import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { SVELTE_RULES, SVELTE_FILES } from '#cli/config/generation/configurations/framework/svelte.ts';

import {
    getPreset,
    convertPresetWarnings,
    buildArrayPresetBlocks,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import {
    CONFIGURATION_PLUGINS,
    TYPESCRIPT_CONFIGURATION,
} from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
Apply the Svelte presets and the Svelte component parser.

@param scope the planned ESLint file of the scope.
@returns the imports and ESLint blocks for this configuration.
*/
export function buildSvelteBlocks(scope: Pick<EslintScope, 'presets' | 'settings'>): ConfigurationBlocks {
    const { presets, settings } = scope;
    const recommended = getPreset(presets, 'recommended');
    const isTyped = settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    const blocks: ConfigurationBlocks['blocks'] = [
        ...buildArrayPresetBlocks(recommended, 'sveltePlugin', convertPresetWarnings),
        {
            fields: {
                files: SVELTE_FILES,
                rules: SVELTE_RULES,
            },
            properties: `languageOptions: { parser: svelteParser, parserOptions: { ${isTyped ? 'parser: { ts: tseslint.parser, typescript: tseslint.parser },' : ''} extraFileExtensions: ['.svelte'] } }`,
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.svelte,
        blocks,
    };
}
