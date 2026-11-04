import { type ConfigurationBuilder } from '#cli/types/configurations/language.ts';
import { SVELTE_RULES, SVELTE_FILES, TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations/framework.ts';

export const SVELTE_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    svelte: (scope) => {
        const isTyped = scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
        return [
            {
                fields: {},
                presets: [{ package: 'eslint-plugin-svelte', path: 'configs.recommended', merge: 'fields' }],
            },
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
    },
};
