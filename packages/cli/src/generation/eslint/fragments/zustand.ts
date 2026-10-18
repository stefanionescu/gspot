import { ZUSTAND_STORE_CREATORS } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment } from '#cli/types/generation/eslint.ts';

/**
 * Apply the Zustand store lint rules to the files of the scope.
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildZustandFragment(
    context: Pick<EslintContext, 'blockWriter' | 'eslintFiles' | 'settings' | 'eslint'>,
): EslintFragment {
    const { blockWriter, eslintFiles, settings, eslint } = context;

    const imports: string[] = [];

    const output: string[] = [
        '\n',
        blockWriter.block({
            files: eslintFiles.code,
            ignores: (settings['zustand.store_files'] as string[] | undefined) ?? [],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        paths: [
                            ...eslint.restrictedImports,
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
        }),
        ',\n\n',
    ];
    return { imports: imports, blocks: output.join('') };
}

export { buildZustandFragment };
