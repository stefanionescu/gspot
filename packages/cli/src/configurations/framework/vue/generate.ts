import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

import {
    VUE_RULES,
    VUE_FILES,
    VUE_SCOPE_RULES,
    TYPESCRIPT_CONFIGURATION,
} from '#cli/config/configurations/framework.ts';

/**
Apply the Vue presets, accessibility lint rules, and component parsing.

@param scope the planned ESLint file of the scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIGURATION_BUILDERS calls it by configuration name, like every block builder.
export function buildVueBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const isTyped = scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    return [
        { fields: {}, presets: [{ package: 'eslint-plugin-vue', path: 'configs.flat/recommended', merge: 'fields' }] },
        { fields: { rules: VUE_SCOPE_RULES } },
        {
            fields: { files: VUE_FILES },
            presets: [
                { package: 'eslint-plugin-vuejs-accessibility', path: 'configs.flat/recommended', merge: 'fields' },
            ],
        },
        {
            fields: {
                files: VUE_FILES,
                languageOptions: { parserOptions: { extraFileExtensions: ['.vue'], sourceType: 'module' } },
                rules: {
                    ...(isTyped && {
                        'vue/define-props-declaration': 'error',
                        'vue/define-emits-declaration': 'error',
                    }),
                    ...VUE_RULES,
                },
            },
            calls: [
                {
                    name: 'setComponentParser',
                    args: [
                        { package: 'vue-eslint-parser' },
                        ...(isTyped ? [{ package: 'typescript-eslint', path: 'parser' }] : []),
                    ],
                },
            ],
        },
    ];
}
