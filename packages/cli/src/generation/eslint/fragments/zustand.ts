import { ZUSTAND_STORE_CREATORS } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment } from '#cli/types/generation/eslint.ts';

/**
 * Apply Zustand store rules to the selected files.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildZustandFragment(
    context: Pick<EslintContext, 'eslintModule' | 'eslintFiles' | 'roles' | 'eslint'>,
): EslintFragment {
    const { eslintModule, eslintFiles, roles, eslint } = context;

    const imports: string[] = [];

    const output: string[] = [
        '\n',
        eslintModule.block({
            files: eslintFiles.code,
            ignores: roles.stores,
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
