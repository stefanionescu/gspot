import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';
import { getPreset, addRuleOptions, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';

import {
    NEXT_RULES,
    REFRESH_RULE,
    JSX_CODE_FILES,
    NEXT_EXTRA_HOCS,
    FRAGMENT_IMPORTS,
    NEXT_SERVER_FILES,
    NEXT_PAGES_FOLDERS,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply the Next.js presets and the pages and JSX settings.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildNextjsFragment(
    context: Pick<EslintFragmentContext, 'presets' | 'eslintFiles' | 'scope' | 'sourceFiles'>,
): EslintFragment {
    const { presets, eslintFiles, scope, sourceFiles } = context;
    const recommended = getPreset(presets, 'recommended');
    const refresh = getPreset(presets, 'refresh');
    const blocks: EslintFragment['blocks'] = [];
    const prefix = scope === '' ? '' : `${scope}/`;
    const hasPages = sourceFiles.some((path) => NEXT_PAGES_FOLDERS.some((folder) => path.startsWith(prefix + folder)));
    blocks.push(
        {
            data: {
                files: JSX_CODE_FILES,
                rules: {
                    ...recommended.blocks[0].rules,
                    '@next/next/no-html-link-for-pages': hasPages
                        ? NEXT_RULES['@next/next/no-html-link-for-pages']
                        : 'off',
                    ...refresh.blocks[0].rules,
                    [REFRESH_RULE]: addRuleOptions(refresh.blocks[0].rules?.[REFRESH_RULE], {
                        extraHOCs: [...NEXT_EXTRA_HOCS],
                    }),
                    '@next/next/no-async-client-component': NEXT_RULES['@next/next/no-async-client-component'],
                },
            },
            properties: `plugins: { '@next/next': nextPlugin }, settings: { next: { rootDir: root + '/' + ${JSON.stringify(scope)} } }`,
            preset: buildPresetRuleExpression([
                ['nextPlugin', recommended],
                ['reactRefresh', refresh],
            ]),
        },
        {
            data: {
                files: NEXT_SERVER_FILES.flatMap((place) => eslintFiles.code.map((pattern) => [place, pattern])),
                rules: { 'gspot/require-server-only': NEXT_RULES['gspot/require-server-only'] },
            },
        },
    );
    return {
        imports: FRAGMENT_IMPORTS['nextjs'],
        blocks,
    };
}
export { buildNextjsFragment };
