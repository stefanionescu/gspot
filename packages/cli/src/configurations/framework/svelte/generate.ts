import { SVELTE_FILES, SVELTE_RULES } from '#cli/config/configurations/framework.ts';
import { TYPESCRIPT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { type EslintBlockBuilder } from '#cli/types/configurations/javascript.ts';

export const SVELTE_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
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
