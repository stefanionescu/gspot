import { CREATE_STORE_MESSAGE, ZUSTAND_STORE_IMPORTS } from '#cli/config/configurations/framework.ts';
import { getTable } from '#cli/settings/scopes.ts';
import {
    type ConfigurationBlocks,
    type ConfigurationBuilder,
    type EslintScope,
} from '#cli/types/configurations/language.ts';

function buildZustandBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'settings'>): ConfigurationBlocks {
    const { eslintFiles, settings } = scope;
    return [
        {
            fields: {
                files: eslintFiles.code,
                ignores: getTable(settings, 'zustand').store_files,
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [
                                ...getTable(settings, 'javascript').banned_imports,
                                ...ZUSTAND_STORE_IMPORTS.map((store) => ({ ...store, message: CREATE_STORE_MESSAGE })),
                            ],
                        },
                    ],
                },
            },
        },
    ];
}

export const ZUSTAND_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    zustand: buildZustandBlocks,
};
