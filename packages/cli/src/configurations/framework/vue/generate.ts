import {
    TYPESCRIPT_CONFIGURATION,
    VUE_FILES,
    VUE_RULES,
    VUE_SCOPE_RULES,
} from '#cli/config/configurations/framework.ts';
import { type ConfigurationBuilder } from '#cli/types/configurations/language.ts';

export const VUE_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    vue: (scope) => {
        const isTyped = scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
        return [
            {
                fields: {},
                presets: [{ package: 'eslint-plugin-vue', path: 'configs.flat/recommended', merge: 'fields' }],
            },
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
    },
};
