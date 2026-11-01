import { getTable } from '#cli/settings/scopes.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/configurations/javascript.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

import {
    CREATE_STORE_MESSAGE,
    ZUSTAND_STORE_IMPORTS,
    CONFIGURATION_PLUGINS,
} from '#cli/config/configurations/framework.ts';

/**
Restrict the Zustand store creators to the store files, so a store lives in a factory that a provider owns.

@param scope the planned ESLint file of the scope.
*/
export function buildZustandBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'settings'>): ConfigurationBlocks {
    const { eslintFiles, settings } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: {
                files: eslintFiles.code,
                ignores: getTable(settings, 'zustand').store_files,
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [
                                ...getTable(settings, ESLINT_SETTINGS_TABLE).restricted_imports,
                                ...ZUSTAND_STORE_IMPORTS.map((store) => ({ ...store, message: CREATE_STORE_MESSAGE })),
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
