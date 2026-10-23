import { getTable } from '#cli/settings/scopes.ts';
import { ZUSTAND_STORE_CREATORS } from '#cli/config/generation/configurations/library/zustand.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    type EslintScope,
    type ConfigurationBlocks,
} from '#cli/types/generation/configurations/language/javascript/eslint.ts';

/**
 * Restrict the Zustand store creators to the store files, so a store lives in a factory that a provider owns.
 *
 * @param scope the planned ESLint file of the scope.
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
