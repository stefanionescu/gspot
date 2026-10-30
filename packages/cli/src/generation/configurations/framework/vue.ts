import { TYPESCRIPT_CONFIGURATION } from '#cli/config/manifests/names.ts';
import { VUE_RULES, VUE_FILES } from '#cli/config/generation/configurations/framework.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';

/**
Apply the Vue presets, accessibility lint rules, and component parsing.

@param scope the planned ESLint file of the scope.
*/
export function buildVueBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const isTyped = scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION);
    const blocks: ConfigurationBlocks['blocks'] = [
        { fields: {}, presets: [{ importName: 'vuePlugin', path: 'configs.flat/recommended', merge: 'spread' }] },
        {
            fields: { files: VUE_FILES },
            presets: [{ importName: 'vueAccessibility', path: 'configs.flat/recommended', merge: 'spread' }],
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
                        { importName: 'vueParser' },
                        ...(isTyped ? [{ importName: 'tseslint', path: 'parser' }] : []),
                    ],
                },
            ],
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.vue,
        blocks,
    };
}
