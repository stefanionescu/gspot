import { getTable } from '#cli/settings/scope-view.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/eslint.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';
import { FRAGMENT_IMPORTS, ZUSTAND_STORE_CREATORS } from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply the Zustand store lint rules to the files of the scope.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildZustandFragment(context: Pick<EslintFragmentContext, 'eslintFiles' | 'view'>): EslintFragment {
    const { eslintFiles, view } = context;
    const blocks: EslintFragment['blocks'] = [
        {
            data: {
                files: eslintFiles.code,
                ignores: (view.settings['zustand.store_files'] as string[] | undefined) ?? [],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [
                                ...getTable(view, ESLINT_SETTINGS_TABLE).restricted_imports,
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
        imports: FRAGMENT_IMPORTS['zustand'],
        blocks,
    };
}
export { buildZustandFragment };
