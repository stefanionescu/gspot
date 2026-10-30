import { TYPESCRIPT_CONFIGURATION } from '#cli/config/manifests/names.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { SVELTE_RULES, SVELTE_FILES } from '#cli/config/generation/configurations/framework/svelte.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
Apply the Svelte presets and the Svelte component parser.

@param scope the planned ESLint file of the scope.
*/
export function buildSvelteBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const isTyped = scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    const blocks: ConfigurationBlocks['blocks'] = [
        { fields: {}, presets: [{ importName: 'sveltePlugin', path: 'configs.recommended', merge: 'spread' }] },
        {
            fields: {
                files: SVELTE_FILES,
                languageOptions: { parserOptions: { extraFileExtensions: ['.svelte'], sourceType: 'module' } },
                rules: SVELTE_RULES,
            },
            calls: [
                {
                    name: 'setComponentParser',
                    args: [
                        { importName: 'svelteParser' },
                        ...(isTyped ? [{ importName: 'tseslint', path: 'parser' }] : []),
                    ],
                },
            ],
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.svelte,
        blocks,
    };
}
