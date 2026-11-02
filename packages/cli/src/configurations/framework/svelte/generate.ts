import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';
import { SVELTE_RULES, SVELTE_FILES, TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations/framework.ts';

/**
Apply the Svelte presets and the Svelte component parser.

@param scope the planned ESLint file of the scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIGURATION_BUILDERS calls it by configuration name, like every block builder.
export function buildSvelteBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const isTyped = scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    return [
        { fields: {}, presets: [{ package: 'eslint-plugin-svelte', path: 'configs.recommended', merge: 'fields' }] },
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
                        { package: 'svelte-eslint-parser' },
                        ...(isTyped ? [{ package: 'typescript-eslint', path: 'parser' }] : []),
                    ],
                },
            ],
        },
    ];
}
