import { VUE_FILES, VUE_RULES, VUE_SCOPE_RULES } from '#cli/config/configurations/framework.ts';
import { TYPESCRIPT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { type EslintBlockBuilder } from '#cli/types/configurations/javascript.ts';

export const VUE_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
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
