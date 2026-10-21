import { getTable } from '#cli/settings/scope-settings.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/eslint/tool-settings.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS, ZUSTAND_STORE_CREATORS } from '#cli/config/generation/eslint/configurations.ts';

/**
 * Apply the Zustand store lint rules to the files of the scope.
 *
 * @param scope the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildZustandBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'settings'>): ConfigurationBlocks {
    const { eslintFiles, settings } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            data: {
                files: eslintFiles.code,
                ignores: (settings.settings['zustand.store_files'] as string[] | undefined) ?? [],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [
                                ...getTable(settings, ESLINT_SETTINGS_TABLE).restricted_imports,
                                {
                                    name: 'zustand',
                                    importNames: ZUSTAND_STORE_CREATORS,
                                    message:
                                        'Create the store inside a factory that a provider owns, not as a module-level store.',
                                },
                            ],
                        },
                    ],
                },
            },
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS['zustand'],
        blocks,
    };
}
